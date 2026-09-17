/**
 * Seed 9 AIFunction (+ trigger Flow masing-masing) yang memanggil bridge
 * Bintang (POST /api/bridge/chatbotx-tool/, lihat
 * bintang-advertising-backend/api/views/chatbotx_bridge.py) dan satu
 * AIAgent yang memakainya -- langkah pertama migrasi WA bot Bintang ke
 * ChatbotX (rancangan 2026-09-15, lanjutan diskusi 2026-09-17: Evolution
 * API dipertahankan, "otak" tetap di Bintang lewat bridge API, ChatbotX
 * jadi kanal/inbox + tempat atur prompt & tools lewat UI).
 *
 * Jalankan dari root repo: pnpm --filter worker exec tsx scripts/seed-wa-bot-tools.ts
 * (atau via package.json script "seed:wa-bot-tools" kalau sudah ditambahkan).
 *
 * Env yang dibutuhkan (baca dari root .env lewat dotenv-cli, sama seperti
 * worker:* scripts lain):
 *   SEED_WORKSPACE_ID     - workspace ChatbotX tujuan (wajib)
 *   BINTANG_BRIDGE_URL    - default https://app.starphotoadvertising.com/api/bridge/chatbotx-tool/
 *   BINTANG_BRIDGE_API_KEY - HARUS sama dengan CHATBOTX_BRIDGE_API_KEY di env Bintang
 *
 * Idempoten per tool: kalau AIFunction dengan nama yang sama sudah ada,
 * di-skip (bukan dibuat dobel) -- aman dijalankan ulang kalau sebagian
 * tool gagal di run sebelumnya.
 *
 * PENTING -- desain "satu field JSON per tool", bukan satu custom field per
 * argumen: AIFunction.dataCollect ChatbotX cuma bisa mengumpulkan atribut
 * STRING DATAR (lihat packages/ai/src/server/tools/functions.ts,
 * inputSchema-nya z.looseObject dari string-string optional) -- tidak ada
 * tipe number/array/object asli. Supaya tool dengan argumen terstruktur
 * (mis. buat_pesanan.items, array of object) tetap bisa jalan, AI diminta
 * (lewat `purpose`) menulis SATU string berisi JSON valid, yang lalu
 * dikirim ke bridge sebagai `arguments` -- bridge Bintang sudah diperbarui
 * (2026-09-17) menerima `arguments` sebagai object ATAU string JSON yang
 * diurai otomatis. Ini juga membuat kesembilan tool seragam (1 custom field
 * input per tool), bukan ~25 field terpisah.
 *
 * Balasan ke pelanggan: bridge Bintang selalu menyertakan `ringkasan` --
 * teks siap-kirim yang sudah dirangkum dari hasil tool apa pun bentuknya
 * (lihat _tambahkan_ringkasan di chatbotx_bridge.py). SATU custom field
 * bersama bernama "ringkasan" dibuat sekali lalu dipakai ulang di
 * `mapping` KESEMBILAN flow (jsonPath "ringkasan" -> field itu) -- tanpa
 * mapping ini token {{ringkasan}} di step sendText tidak akan pernah
 * ter-isi: callApi hanya mengisi {{var}} pada REQUEST yang dikirim
 * (resolveJsonBodyVariables), field dari RESPONS hanya masuk ke contact
 * lewat `mapping`-nya sendiri (lihat executeAndMap, packages/business/src/
 * external-request/service.ts) -- baru sesudah itu tersedia sebagai
 * {{ringkasan}} di step-step berikutnya.
 */
// Side-effect import WAJIB sebelum service manapun yang memanggil
// this.audit() (mis. aiFunctionService.create/aiAgentService.create) --
// tanpa ini, "Audit recorder is not registered" (dispatcher.ts). apps/
// builder & apps/worker meng-import ini otomatis lewat bootstrap masing-
// masing; script standalone ini harus melakukannya sendiri secara
// eksplisit.
import "@chatbotx.io/business/audit"
import {
  aiAgentService,
  aiFunctionService,
  customFieldService,
  flowService,
} from "@chatbotx.io/business"
import { db } from "@chatbotx.io/database/client"
import {
  chooseChannelStepDefaultFn,
  type EdgeSchema,
  externalRequestStepDefaultFn,
  performActionNodeDefaultFn,
  sendMessageNodeDefaultFn,
  sendTextStepDefaultFn,
} from "@chatbotx.io/flow-config"
import { createId } from "@chatbotx.io/utils"

const WORKSPACE_ID = process.env.SEED_WORKSPACE_ID
const BRIDGE_URL =
  process.env.BINTANG_BRIDGE_URL ??
  "https://app.starphotoadvertising.com/api/bridge/chatbotx-tool/"
const BRIDGE_API_KEY = process.env.BINTANG_BRIDGE_API_KEY

if (!WORKSPACE_ID) {
  throw new Error("SEED_WORKSPACE_ID wajib diisi (lihat header file ini).")
}
if (!BRIDGE_API_KEY) {
  throw new Error(
    "BINTANG_BRIDGE_API_KEY wajib diisi -- harus SAMA dengan CHATBOTX_BRIDGE_API_KEY di env Bintang.",
  )
}

type ToolConfig = {
  /** Nama tool di Bintang (services/wa_ai_tools.py TOOL_SCHEMAS) -- juga
   * jadi nama AIFunction & nama custom field input, supaya gampang
   * ditelusuri balik. */
  toolName: string
  /** Kapan AI harus panggil tool ini + format argumen yang diharapkan --
   * diperlihatkan ke LLM sebagai deskripsi tool. */
  purpose: string
  /** false utk tool tanpa argumen sama sekali (mis. produk_terlaris) --
   * tidak butuh custom field input atau dataCollect. */
  hasArgs: boolean
}

const TOOLS: ToolConfig[] = [
  {
    toolName: "daftar_kategori_produk",
    hasArgs: true,
    purpose:
      'Daftar kategori produk & harga referensi resmi dari pricelist toko -- SATU-SATUNYA sumber jawaban produk/harga. WAJIB dipakai untuk pertanyaan jelajah umum (\'ada produk apa saja\', minta lihat katalog). Tulis argumen sebagai JSON, contoh: {} (kosong, untuk lihat daftar semua kategori dulu) atau {"kategori": "banner"} (untuk detail satu kategori, slug dari hasil panggilan pertama).',
  },
  {
    toolName: "hitung_harga_pricelist",
    hasArgs: true,
    purpose:
      'Hitung TOTAL harga resmi dari pricelist untuk kategori yang datanya terstruktur (banner, stiker, kertas_a3, kartu_nama) -- WAJIB dipakai kalau pelanggan sebut qty/ukuran spesifik & minta tahu totalnya, JANGAN PERNAH menghitung sendiri. Tulis argumen sebagai JSON, contoh: {"kategori": "banner", "qty": 1, "panjang": 2, "lebar": 1}. panjang/lebar (meter) wajib khusus kategori banner.',
  },
  {
    toolName: "cek_status_pesanan",
    hasArgs: true,
    purpose:
      'Cek status pesanan pelanggan yang sedang chat ini. Tulis argumen sebagai JSON, contoh: {"nomor_order": "ORD-20260910-XXXX"} kalau pelanggan sebut ID pesanan, atau {} (kosong) untuk cari pesanan terbaru pelanggan ini secara otomatis.',
  },
  {
    toolName: "produk_terlaris",
    hasArgs: false,
    purpose:
      "Daftar produk paling sering dipesan pelanggan lain (data riwayat order asli) -- pakai untuk rekomendasi kalau pelanggan belum tahu mau pesan apa. Tidak butuh argumen.",
  },
  {
    toolName: "produk_sesuai_budget",
    hasArgs: true,
    purpose:
      'Cari produk dengan harga TETAP (bukan per meter persegi) yang muat di budget pelanggan. Pakai kalau pelanggan sebut nominal budget tanpa nama produk spesifik. Tulis argumen sebagai JSON, contoh: {"budget": 200000}.',
  },
  {
    toolName: "cek_faq",
    hasArgs: true,
    purpose:
      'Cari jawaban dari daftar FAQ resmi toko (jam buka, lokasi, kebijakan umum, dll) sebelum menjawab dari pengetahuan umum. Tulis argumen sebagai JSON, contoh: {"pertanyaan": "apakah bisa COD?"} -- isi pertanyaan pelanggan apa adanya.',
  },
  {
    toolName: "ambil_template_form_order",
    hasArgs: true,
    purpose:
      'Ambil TEMPLATE resmi form order untuk dikirim ke pelanggan yang siap order. Balasannya WAJIB diteruskan PERSIS APA ADANYA ke pelanggan. Tulis argumen sebagai JSON, contoh: {"jenis_produk": "Banner", "bahan": "", "finishing": ""} -- kosongkan field yang belum diketahui.',
  },
  {
    toolName: "buat_pesanan",
    hasArgs: true,
    purpose:
      'Buat draft pesanan dari data yang sudah dikumpulkan lewat percakapan. SELALU pastikan Bahan & Finishing terisi dulu kalau produknya butuh. Tulis argumen sebagai JSON dengan bentuk PERSIS: {"items": [{"jenis_produk": "...", "qty": 1, "panjang": 0, "lebar": 0, "bahan": "", "finishing": "", "keterangan": "", "file_desain_sudah_ada": false}]} -- items adalah array, bisa berisi lebih dari satu produk. Kalau hasilnya minta data tambahan, JANGAN panggil lagi sebelum pelanggan melengkapinya. Kalau berhasil, sampaikan rekap ke pelanggan dan minta konfirmasi \'sesuai\'.',
  },
  {
    toolName: "eskalasi_admin",
    hasArgs: true,
    purpose:
      'Teruskan permintaan pelanggan ke admin/manager manusia -- pakai untuk hal di luar wewenangmu: komplain, retur/pembatalan pesanan selesai, permintaan diskon khusus, atau kalau benar-benar tidak yakin jawabannya setelah coba tools lain. JANGAN pernah menjanjikan sesuatu yang bukan wewenangmu. Tulis argumen sebagai JSON, contoh: {"alasan": "ringkasan singkat kenapa perlu eskalasi"}.',
  },
]

const ERROR_TEXT_FALLBACK =
  "Maaf, ada kendala teknis saat memproses permintaan ini. {{ringkasan}}"

function addHandleEdge(
  edges: EdgeSchema[],
  source: string,
  handleId: string,
  target: string,
): void {
  edges.push({
    id: createId(),
    source,
    sourceHandle: handleId,
    target,
    targetHandle: target,
  })
}

/**
 * Bangun satu flow lengkap: performAction (1 step callApi ke bridge
 * Bintang) -> sukses: sendMessage {{ringkasan}}, gagal: sendMessage pesan
 * maaf generik. Dipublikasikan langsung (createPublishedDefault, pola yang
 * sama dipakai instalasi template ChatbotX sendiri).
 */
async function buildAndCreateFlow(
  tool: ToolConfig,
  argsFieldName: string | null,
  ringkasanFieldId: string,
) {
  const jsonBodyParts: string[] = [`"tool": "${tool.toolName}"`]
  if (argsFieldName) {
    jsonBodyParts.push(`"arguments": {{${argsFieldName}}}`)
  }
  jsonBodyParts.push(
    `"context": {"nomor": "{{phone}}", "nama_pelanggan": "{{full_name}}"}`,
  )
  const jsonBody = `{${jsonBodyParts.join(", ")}}`

  const callStep = externalRequestStepDefaultFn({
    method: "POST",
    url: BRIDGE_URL,
    headers: [
      { key: "Content-Type", value: "application/json" },
      { key: "X-Api-Key", value: BRIDGE_API_KEY as string },
    ],
    body: { bodyType: "json", jsonBody },
    // Bridge SELALU menyertakan `ringkasan` di body respons (sukses
    // maupun gagal, lihat _tambahkan_ringkasan di chatbotx_bridge.py) --
    // satu mapping ini cukup utk kedua state (successState & errorState
    // sama-sama berhak baca field yang sama).
    mapping: [{ jsonPath: "ringkasan", outputFieldId: ringkasanFieldId }],
  })

  const performActionNode = performActionNodeDefaultFn({
    dataProps: { name: `Panggil Bintang: ${tool.toolName}`, isStartNode: true },
    nodeProps: { position: { x: 0, y: 0 } },
  })
  performActionNode.data.details.steps = [callStep]

  const successNode = sendMessageNodeDefaultFn({
    dataProps: { name: "Balasan Sukses", isStartNode: false },
    nodeProps: { position: { x: 400, y: -100 } },
  })
  successNode.data.details.beforeStep = chooseChannelStepDefaultFn()
  successNode.data.details.steps = [
    sendTextStepDefaultFn({ text: "{{ringkasan}}" }),
  ]

  const errorNode = sendMessageNodeDefaultFn({
    dataProps: { name: "Balasan Gagal", isStartNode: false },
    nodeProps: { position: { x: 400, y: 200 } },
  })
  errorNode.data.details.beforeStep = chooseChannelStepDefaultFn()
  errorNode.data.details.steps = [
    sendTextStepDefaultFn({ text: ERROR_TEXT_FALLBACK }),
  ]

  const edges: EdgeSchema[] = []
  const [successState, errorState] = callStep.states
  addHandleEdge(edges, performActionNode.id, successState.id, successNode.id)
  addHandleEdge(edges, performActionNode.id, errorState.id, errorNode.id)

  return await db.transaction(
    async (tx) =>
      await flowService.createPublishedDefault(tx, {
        name: `[WA Bot] ${tool.toolName}`,
        workspaceId: WORKSPACE_ID as string,
        startNodeId: performActionNode.id,
        nodes: [performActionNode, successNode, errorNode],
        edges,
      }),
  )
}

async function ensureCustomField(name: string): Promise<string> {
  const existing = await db.query.customFieldModel.findFirst({
    where: { workspaceId: WORKSPACE_ID as string, name },
  })
  if (existing) {
    console.log(`  custom field '${name}' sudah ada (#${existing.id})`)
    return existing.id
  }
  const created = await customFieldService.create({
    workspaceId: WORKSPACE_ID as string,
    data: { name, type: "longText" },
  })
  console.log(`  custom field '${name}' dibuat (#${created.id})`)
  return created.id
}

async function seedOneTool(
  tool: ToolConfig,
  ringkasanFieldId: string,
): Promise<string> {
  console.log(`\n=== ${tool.toolName} ===`)

  const existingFn = await db.query.aiFunctionModel.findFirst({
    where: { workspaceId: WORKSPACE_ID as string, name: tool.toolName },
  })
  if (existingFn) {
    console.log(
      `  AIFunction '${tool.toolName}' sudah ada (#${existingFn.id}), di-skip.`,
    )
    return existingFn.id
  }

  let argsFieldName: string | null = null
  let argsFieldId: string | null = null
  if (tool.hasArgs) {
    argsFieldName = `${tool.toolName}_args`
    argsFieldId = await ensureCustomField(argsFieldName)
  }

  const { flowId } = await buildAndCreateFlow(
    tool,
    argsFieldName,
    ringkasanFieldId,
  )
  console.log(`  flow dibuat (#${flowId})`)

  const created = await aiFunctionService.create(WORKSPACE_ID as string, {
    name: tool.toolName,
    purpose: tool.purpose,
    dataCollect:
      argsFieldName && argsFieldId
        ? [{ from: `${tool.toolName} argumen (JSON)`, to: argsFieldId }]
        : [],
    outputMessage: null,
    triggerFlowId: flowId,
  })
  const aiFunctionId = created[0].id
  console.log(`  AIFunction dibuat (#${aiFunctionId})`)
  return aiFunctionId
}

async function main() {
  console.log(`Seeding 9 WA bot tools ke workspace ${WORKSPACE_ID}...`)
  console.log(`Bridge URL: ${BRIDGE_URL}`)

  console.log("\nMenyiapkan custom field bersama 'ringkasan'...")
  const ringkasanFieldId = await ensureCustomField("ringkasan")

  const aiFunctionIds: string[] = []
  for (const tool of TOOLS) {
    const id = await seedOneTool(tool, ringkasanFieldId)
    aiFunctionIds.push(id)
  }

  const toolRefs = aiFunctionIds.map((id) => `fn:${id}`)

  const existingAgent = await db.query.aiAgentModel.findFirst({
    where: { workspaceId: WORKSPACE_ID as string, name: "WA Bot Bintang" },
  })

  if (existingAgent) {
    console.log(
      `\nAIAgent 'WA Bot Bintang' sudah ada (#${existingAgent.id}) -- perbarui daftar tools-nya saja (prompt TIDAK ditimpa, sunting manual lewat UI kalau perlu diubah).`,
    )
    const mergedTools = Array.from(
      new Set([...(existingAgent.tools ?? []), ...toolRefs]),
    )
    await aiAgentService.updateAIAgent(
      { workspaceId: WORKSPACE_ID as string, id: existingAgent.id },
      { tools: mergedTools },
    )
    console.log("  tools AIAgent diperbarui.")
    return
  }

  const agentId = await aiAgentService.create(WORKSPACE_ID as string, {
    name: "WA Bot Bintang",
    // DRAFT AWAL -- bukan salinan persis prompt KoboiLLM yang dipakai
    // wa_logic.py/wa_ai_tools.py sekarang (prompt aslinya tidak ditemukan
    // sebagai teks statis di kode, kemungkinan disusun dinamis di
    // runtime) -- sunting lewat UI ChatbotX sebelum dipakai produksi.
    prompt:
      "Kamu adalah Customer Service STAR Photo & Advertising, melayani lewat WhatsApp. " +
      "Gaya bicara ramah, profesional, cepat tanggap (gaya WOW Service toko). " +
      "SELALU pakai tools yang tersedia untuk info produk, harga, status pesanan, dan FAQ -- " +
      "JANGAN PERNAH mengarang atau menghitung sendiri harga/info yang seharusnya dari tools. " +
      "Kalau ada permintaan di luar wewenangmu (komplain, retur, diskon khusus) atau kamu tidak yakin, " +
      "gunakan tool eskalasi_admin, jangan menjanjikan sesuatu yang bukan wewenangmu.",
    messages: [],
    models: [{ provider: "openai", model: "gpt-4o-mini" }],
    temperature: 0.3,
    maxOutputTokens: 800,
    tools: toolRefs,
    isDefault: false,
    isRichResponse: false,
  })
  console.log(
    `\nAIAgent 'WA Bot Bintang' dibuat (#${agentId}) dengan ${toolRefs.length} tools.`,
  )
  console.log(
    "\nSELESAI. Langkah berikutnya (manual, lewat UI ChatbotX): " +
      "sambungkan channel WhatsApp, tautkan AIAgent ini ke channel itu, lalu uji coba.",
  )
}

main()
  .then(() => {
    console.log("\nSeed selesai.")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\nSeed GAGAL:", error)
    process.exit(1)
  })

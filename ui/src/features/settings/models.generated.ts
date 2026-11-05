// 由 tools/sync-models.mjs 从 https://models.dev/api.json 生成，请勿手改。
// 更新：node tools/sync-models.mjs
// REASON: 生成的数据表，行数由 models.dev 目录决定，不按手写单文件行数约束拆。

export interface GeneratedModel {
  id: string
  label: string
  priceInput: number
  priceOutput: number
}

export interface GeneratedProvider {
  id: string
  name: string
  providerName: string
  baseUrl: string
  note: string
  models: GeneratedModel[]
  priceInput: number
  priceOutput: number
}

export const MODELS_SYNCED_AT = '2026-11-05'

export const MODELS_DEV_PROVIDERS: GeneratedProvider[] = [
  {
    "id": "deepseek",
    "name": "DeepSeek",
    "providerName": "deepseek",
    "baseUrl": "https://api.deepseek.com",
    "note": "models.dev · DeepSeek",
    "models": [
      {
        "id": "deepseek-flash",
        "label": "DeepSeek V4.1 Flash 1017",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "deepseek-v4-flash",
        "label": "DeepSeek V4 Flash",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "deepseek-v4-flash-vision-exp",
        "label": "DeepSeek V4 Flash Vision Exp",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "deepseek-v4-pro",
        "label": "DeepSeek V4 Pro",
        "priceInput": 0.66,
        "priceOutput": 1.98
      }
    ],
    "priceInput": 0.15,
    "priceOutput": 0.6
  },
  {
    "id": "openai",
    "name": "OpenAI",
    "providerName": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "note": "models.dev · OpenAI（使用 OpenAI 兼容端点）",
    "models": [
      {
        "id": "gpt-6.1-terra",
        "label": "GPT-6.1 Terra",
        "priceInput": 1,
        "priceOutput": 5
      },
      {
        "id": "gpt-6.1-sol",
        "label": "GPT-6.1 Sol",
        "priceInput": 2,
        "priceOutput": 10
      },
      {
        "id": "gpt-6-luna",
        "label": "GPT-6 Luna",
        "priceInput": 0.1,
        "priceOutput": 0.5
      },
      {
        "id": "gpt-6-sol",
        "label": "GPT-6 Sol",
        "priceInput": 2,
        "priceOutput": 10
      },
      {
        "id": "gpt-6-astra",
        "label": "GPT-6 Astra",
        "priceInput": 10,
        "priceOutput": 50
      },
      {
        "id": "gpt-daybreak-blue-latest",
        "label": "Daybreak Blue",
        "priceInput": 4,
        "priceOutput": 20
      },
      {
        "id": "gpt-daybreak-red-latest",
        "label": "Daybreak Red",
        "priceInput": 12.5,
        "priceOutput": 75
      },
      {
        "id": "gpt-5.6",
        "label": "GPT-5.6",
        "priceInput": 4,
        "priceOutput": 20
      },
      {
        "id": "gpt-5.6-luna",
        "label": "GPT-5.6 Luna",
        "priceInput": 0.2,
        "priceOutput": 1.2
      },
      {
        "id": "gpt-5.6-sol",
        "label": "GPT-5.6 Sol",
        "priceInput": 4,
        "priceOutput": 20
      },
      {
        "id": "gpt-5.6-terra",
        "label": "GPT-5.6 Terra",
        "priceInput": 2,
        "priceOutput": 12
      },
      {
        "id": "gpt-realtime-2.1",
        "label": "GPT-Realtime-2.1",
        "priceInput": 4,
        "priceOutput": 24
      },
      {
        "id": "gpt-5.5",
        "label": "GPT-5.5",
        "priceInput": 5,
        "priceOutput": 30
      },
      {
        "id": "gpt-5.5-pro",
        "label": "GPT-5.5 Pro",
        "priceInput": 30,
        "priceOutput": 180
      },
      {
        "id": "gpt-5.4-mini",
        "label": "GPT-5.4 mini",
        "priceInput": 0.75,
        "priceOutput": 4.5
      },
      {
        "id": "gpt-5.4-nano",
        "label": "GPT-5.4 nano",
        "priceInput": 0.2,
        "priceOutput": 1.25
      },
      {
        "id": "gpt-5.4",
        "label": "GPT-5.4",
        "priceInput": 2.5,
        "priceOutput": 15
      },
      {
        "id": "gpt-5.4-pro",
        "label": "GPT-5.4 Pro",
        "priceInput": 30,
        "priceOutput": 180
      },
      {
        "id": "gpt-5.3-codex",
        "label": "GPT-5.3 Codex",
        "priceInput": 1.75,
        "priceOutput": 14
      },
      {
        "id": "gpt-5.3-codex-spark",
        "label": "GPT-5.3 Codex Spark",
        "priceInput": 1.75,
        "priceOutput": 14
      },
      {
        "id": "gpt-5.2",
        "label": "GPT-5.2",
        "priceInput": 1.75,
        "priceOutput": 14
      },
      {
        "id": "gpt-5.2-pro",
        "label": "GPT-5.2 Pro",
        "priceInput": 21,
        "priceOutput": 168
      },
      {
        "id": "gpt-5.1",
        "label": "GPT-5.1",
        "priceInput": 1.25,
        "priceOutput": 10
      },
      {
        "id": "gpt-5-pro",
        "label": "GPT-5 Pro",
        "priceInput": 15,
        "priceOutput": 120
      }
    ],
    "priceInput": 1,
    "priceOutput": 5
  },
  {
    "id": "volcengine",
    "name": "火山方舟（豆包）",
    "providerName": "volcengine",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
    "note": "models.dev · Volcengine Ark",
    "models": [
      {
        "id": "glm-5-3-flash-260828",
        "label": "GLM-5.3-Flash",
        "priceInput": 0.11875,
        "priceOutput": 0.41563
      },
      {
        "id": "deepseek-v4-pro-ga-260813",
        "label": "DeepSeek V4 Pro 0813",
        "priceInput": 1.3359,
        "priceOutput": 4.00771
      },
      {
        "id": "deepseek-v4-flash-ga-260731",
        "label": "DeepSeek V4 Flash 0731",
        "priceInput": 0.4453,
        "priceOutput": 1.3359
      },
      {
        "id": "doubao-seed-2-1-pro-260628",
        "label": "Seed 2.1 Pro",
        "priceInput": 0.8906,
        "priceOutput": 4.45301
      },
      {
        "id": "doubao-seed-2-1-turbo-260628",
        "label": "Seed 2.1 Turbo",
        "priceInput": 0.4453,
        "priceOutput": 2.22651
      },
      {
        "id": "doubao-seed-character-260628",
        "label": "Seed Character",
        "priceInput": 0.11875,
        "priceOutput": 0.29687
      },
      {
        "id": "doubao-seed-evolving",
        "label": "Seed Evolving",
        "priceInput": 0.8906,
        "priceOutput": 4.45301
      },
      {
        "id": "glm-5-2-260617",
        "label": "GLM-5.2",
        "priceInput": 1.18747,
        "priceOutput": 4.15615
      },
      {
        "id": "doubao-seed-2-0-code-preview-260215",
        "label": "Seed 2.0 Code",
        "priceInput": 0.47499,
        "priceOutput": 2.37494
      },
      {
        "id": "doubao-seed-2-0-lite-260428",
        "label": "Seed 2.0 Lite",
        "priceInput": 0.08906,
        "priceOutput": 0.53436
      },
      {
        "id": "doubao-seed-2-0-mini-260428",
        "label": "Seed 2.0 Mini",
        "priceInput": 0.02969,
        "priceOutput": 0.29687
      },
      {
        "id": "doubao-seed-2-0-pro-260215",
        "label": "Seed 2.0 Pro",
        "priceInput": 0.47499,
        "priceOutput": 2.37494
      },
      {
        "id": "doubao-seed-1-8-251228",
        "label": "Seed 1.8",
        "priceInput": 0.11875,
        "priceOutput": 1.18747
      },
      {
        "id": "doubao-seed-1-6-251015",
        "label": "Seed 1.6",
        "priceInput": 0.11875,
        "priceOutput": 1.18747
      },
      {
        "id": "doubao-seed-1-6-flash-250828",
        "label": "Seed 1.6 Flash",
        "priceInput": 0.02227,
        "priceOutput": 0.22265
      },
      {
        "id": "doubao-seed-1-6-vision-250815",
        "label": "Seed 1.6 Vision",
        "priceInput": 0.11875,
        "priceOutput": 1.18747
      }
    ],
    "priceInput": 0.11875,
    "priceOutput": 0.41563
  },
  {
    "id": "moonshot",
    "name": "Moonshot / Kimi",
    "providerName": "moonshot",
    "baseUrl": "https://api.moonshot.ai/v1",
    "note": "models.dev · Moonshot AI",
    "models": [
      {
        "id": "kimi-k3.1-pro",
        "label": "Kimi K3.1 Pro",
        "priceInput": 2,
        "priceOutput": 10
      },
      {
        "id": "kimi-k3.1-pro-highspeed",
        "label": "Kimi K3.1 Pro Highspeed",
        "priceInput": 4,
        "priceOutput": 20
      },
      {
        "id": "kimi-k3",
        "label": "Kimi K3",
        "priceInput": 3,
        "priceOutput": 15
      },
      {
        "id": "kimi-k2.7-code",
        "label": "Kimi K2.7 Code",
        "priceInput": 0.95,
        "priceOutput": 4
      },
      {
        "id": "kimi-k2.7-code-highspeed",
        "label": "Kimi K2.7 Code HighSpeed",
        "priceInput": 1.9,
        "priceOutput": 8
      },
      {
        "id": "kimi-k2.6",
        "label": "Kimi K2.6",
        "priceInput": 0.95,
        "priceOutput": 4
      }
    ],
    "priceInput": 2,
    "priceOutput": 10
  },
  {
    "id": "zhipu",
    "name": "智谱 GLM",
    "providerName": "zhipu",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "note": "models.dev · Zhipu AI",
    "models": [
      {
        "id": "glm-5.3-flashx",
        "label": "GLM-5.3-FlashX",
        "priceInput": 0.29879,
        "priceOutput": 1.04577
      },
      {
        "id": "glm-5.3-flash",
        "label": "GLM-5.3-Flash",
        "priceInput": 0.11952,
        "priceOutput": 0.41831
      },
      {
        "id": "glm-5.3",
        "label": "GLM-5.3",
        "priceInput": 1.19516,
        "priceOutput": 4.18306
      },
      {
        "id": "glm-5.2",
        "label": "GLM-5.2",
        "priceInput": 1.19516,
        "priceOutput": 4.18306
      },
      {
        "id": "glm-5.1",
        "label": "GLM-5.1",
        "priceInput": 0.89637,
        "priceOutput": 3.58548
      },
      {
        "id": "glm-5v-turbo",
        "label": "GLM-5V-Turbo",
        "priceInput": 0.74698,
        "priceOutput": 3.28669
      },
      {
        "id": "glm-5",
        "label": "GLM-5",
        "priceInput": 0.59758,
        "priceOutput": 2.68911
      },
      {
        "id": "glm-4.7-flash",
        "label": "GLM-4.7-Flash",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "glm-4.7-flashx",
        "label": "GLM-4.7-FlashX",
        "priceInput": 0.0747,
        "priceOutput": 0.44819
      },
      {
        "id": "glm-4.7",
        "label": "GLM-4.7",
        "priceInput": 0.44819,
        "priceOutput": 2.09153
      },
      {
        "id": "glm-4.6v",
        "label": "GLM-4.6V",
        "priceInput": 0.1494,
        "priceOutput": 0.44819
      },
      {
        "id": "glm-4.6v-flash",
        "label": "GLM-4.6V-Flash",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "glm-4.6",
        "label": "GLM-4.6",
        "priceInput": 0.6,
        "priceOutput": 2.2
      },
      {
        "id": "glm-4.5v",
        "label": "GLM-4.5V",
        "priceInput": 0.29879,
        "priceOutput": 0.89637
      },
      {
        "id": "glm-4.5",
        "label": "GLM-4.5",
        "priceInput": 0.6,
        "priceOutput": 2.2
      },
      {
        "id": "glm-4.5-air",
        "label": "GLM-4.5-Air",
        "priceInput": 0.11952,
        "priceOutput": 0.89637
      },
      {
        "id": "glm-4.5-flash",
        "label": "GLM-4.5-Flash",
        "priceInput": 0,
        "priceOutput": 0
      }
    ],
    "priceInput": 0.29879,
    "priceOutput": 1.04577
  },
  {
    "id": "openrouter",
    "name": "OpenRouter",
    "providerName": "openrouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "note": "models.dev · OpenRouter",
    "models": [
      {
        "id": "ricursiveai/ripple-65b-preview",
        "label": "ricursiveAI/Ripple-65B-Preview",
        "priceInput": 0.2,
        "priceOutput": 0.6
      },
      {
        "id": "tencent/hy4",
        "label": "Hy4",
        "priceInput": 0.417,
        "priceOutput": 1.2505
      },
      {
        "id": "stealth/crouton-alpha",
        "label": "Crouton Alpha",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "z-ai/glm-5.3-flashx-legal",
        "label": "GLM 5.3 FlashX Legal",
        "priceInput": 0.37,
        "priceOutput": 1.25
      },
      {
        "id": "particle-ai/particle-1",
        "label": "Particle-1",
        "priceInput": 0.05,
        "priceOutput": 0.5
      },
      {
        "id": "openai/gpt-6.1-terra",
        "label": "GPT-6.1 Terra",
        "priceInput": 1,
        "priceOutput": 5
      },
      {
        "id": "openai/gpt-6.1-terra-pro",
        "label": "GPT-6.1 Terra Pro",
        "priceInput": 1,
        "priceOutput": 5
      },
      {
        "id": "moonshotai/kimi-k3.1-pro",
        "label": "Kimi K3.1 Pro",
        "priceInput": 2,
        "priceOutput": 10
      },
      {
        "id": "recursive/flint-v1.0:free",
        "label": "Flint (free)",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "minimax/minimax-m3.1-flash",
        "label": "MiniMax-M3.1-Flash",
        "priceInput": 0.075,
        "priceOutput": 0.3
      },
      {
        "id": "deepseek/deepseek-v4.1-flash-1017",
        "label": "DeepSeek V4.1 Flash 1017",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "elorian/glimpse",
        "label": "Glimpse",
        "priceInput": 0.6,
        "priceOutput": 3
      },
      {
        "id": "inception/mercury-3",
        "label": "Mercury 3",
        "priceInput": 0.1,
        "priceOutput": 0.35
      },
      {
        "id": "prism-ml/ternary-bonsai-2-9b",
        "label": "Ternary Bonsai 2 9B",
        "priceInput": 0.08,
        "priceOutput": 0.13
      },
      {
        "id": "xingchen-agi/xing4.0-29b-a4b:free",
        "label": "Xing4.0 29B A4B (free)",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "meta/muse-spark-open",
        "label": "Muse Spark Open",
        "priceInput": 1.25,
        "priceOutput": 4.25
      },
      {
        "id": "moondream/moondream3-preview",
        "label": "Moondream 3 Preview",
        "priceInput": 0.3,
        "priceOutput": 2.5
      },
      {
        "id": "moondream/moondream3.1-9b-a2b",
        "label": "Moondream 3.1",
        "priceInput": 0.3,
        "priceOutput": 2.5
      },
      {
        "id": "nvidia/nemotron-3.5-super-vl",
        "label": "Nemotron 3.5 Super VL",
        "priceInput": 0.15,
        "priceOutput": 0.5
      },
      {
        "id": "nvidia/nemotron-3.5-super-vl:free",
        "label": "Nemotron 3.5 Super VL (free)",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "unbiased/pareto-26.10",
        "label": "Pareto 26.10",
        "priceInput": 0.8,
        "priceOutput": 3.2
      },
      {
        "id": "~unbiased/pareto-latest",
        "label": "Pareto Latest",
        "priceInput": 0.8,
        "priceOutput": 3.2
      },
      {
        "id": "google/gemini-4-argon",
        "label": "Gemini 4 Argon",
        "priceInput": 2,
        "priceOutput": 10
      },
      {
        "id": "liquid/lfm-2.5-24b-a2b",
        "label": "LFM2.5-24B-A2B",
        "priceInput": 0.05,
        "priceOutput": 0.7
      }
    ],
    "priceInput": 0.2,
    "priceOutput": 0.6
  },
  {
    "id": "siliconflow",
    "name": "硅基流动",
    "providerName": "siliconflow",
    "baseUrl": "https://api.siliconflow.com/v1",
    "note": "models.dev · SiliconFlow",
    "models": [
      {
        "id": "zai-org/GLM-5.3-Flash",
        "label": "GLM-5.3-Flash",
        "priceInput": 0.15,
        "priceOutput": 0.5
      },
      {
        "id": "deepseek-ai/DeepSeek-V4-Flash-Vision-Exp",
        "label": "DeepSeek V4 Flash Vision Exp",
        "priceInput": 0.44,
        "priceOutput": 1.32
      },
      {
        "id": "zai-org/GLM-5.3",
        "label": "GLM-5.3",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "deepseek-ai/DeepSeek-V4-Pro-0813",
        "label": "DeepSeek V4 Pro 0813",
        "priceInput": 1.32,
        "priceOutput": 3.96
      },
      {
        "id": "Qwen/Qwen3.8-2.4T-A95B",
        "label": "Qwen3.8 2.4T A95B",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "deepseek-ai/DeepSeek-V4-Flash-0731",
        "label": "DeepSeek V4 Flash 0731",
        "priceInput": 0.22,
        "priceOutput": 0.66
      },
      {
        "id": "moonshotai/Kimi-K3",
        "label": "Kimi K3",
        "priceInput": 2.7,
        "priceOutput": 13.5
      },
      {
        "id": "tencent/Hy3",
        "label": "Hy3",
        "priceInput": 0.132,
        "priceOutput": 0.528
      },
      {
        "id": "meituan-longcat/LongCat-2.0",
        "label": "LongCat-2.0",
        "priceInput": 0.75,
        "priceOutput": 2.95
      },
      {
        "id": "zai-org/GLM-5.2",
        "label": "GLM-5.2",
        "priceInput": 1.302,
        "priceOutput": 4.092
      },
      {
        "id": "moonshotai/Kimi-K2.7-Code",
        "label": "Kimi K2.7 Code",
        "priceInput": 0.85916,
        "priceOutput": 3.8
      },
      {
        "id": "google/gemma-4-12B-it",
        "label": "Gemma 4 12B IT",
        "priceInput": 0.1,
        "priceOutput": 0.3
      },
      {
        "id": "nex-agi/Nex-N2-Pro",
        "label": "Nex-N2-Pro",
        "priceInput": 0.5,
        "priceOutput": 2.5
      },
      {
        "id": "MiniMaxAI/MiniMax-M3",
        "label": "MiniMax-M3",
        "priceInput": 0.3,
        "priceOutput": 1.2
      },
      {
        "id": "deepseek-ai/DeepSeek-V4-Flash",
        "label": "DeepSeek V4 Flash",
        "priceInput": 0.13,
        "priceOutput": 0.28
      },
      {
        "id": "deepseek-ai/DeepSeek-V4-Pro",
        "label": "DeepSeek V4 Pro",
        "priceInput": 1.50162,
        "priceOutput": 3.135
      },
      {
        "id": "Qwen/Qwen3.6-27B",
        "label": "Qwen3.6 27B",
        "priceInput": 0.3,
        "priceOutput": 3.2
      },
      {
        "id": "moonshotai/Kimi-K2.6",
        "label": "moonshotai/Kimi-K2.6",
        "priceInput": 0.77,
        "priceOutput": 3.4
      },
      {
        "id": "Qwen/Qwen3.6-35B-A3B",
        "label": "Qwen3.6 35B-A3B",
        "priceInput": 0.24,
        "priceOutput": 1.8
      },
      {
        "id": "zai-org/GLM-5.1",
        "label": "zai-org/GLM-5.1",
        "priceInput": 1.19,
        "priceOutput": 3.74
      },
      {
        "id": "google/gemma-4-26B-A4B-it",
        "label": "Gemma 4 26B A4B IT",
        "priceInput": 0.14,
        "priceOutput": 0.4
      },
      {
        "id": "google/gemma-4-31B-it",
        "label": "Gemma 4 31B IT",
        "priceInput": 0.75,
        "priceOutput": 1
      },
      {
        "id": "zai-org/GLM-5V-Turbo",
        "label": "zai-org/GLM-5V-Turbo",
        "priceInput": 1.2,
        "priceOutput": 4
      },
      {
        "id": "Qwen/Qwen3.5-122B-A10B",
        "label": "Qwen3.5 122B-A10B",
        "priceInput": 0.26,
        "priceOutput": 2.08
      }
    ],
    "priceInput": 0.15,
    "priceOutput": 0.5
  },
  {
    "id": "alibaba",
    "name": "阿里云百炼",
    "providerName": "alibaba",
    "baseUrl": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "note": "models.dev · Alibaba",
    "models": [
      {
        "id": "qwen3.8-omni-flash",
        "label": "Qwen3.8 Omni Flash",
        "priceInput": 0.15,
        "priceOutput": 0.47
      },
      {
        "id": "qwen3.8-flash",
        "label": "Qwen3.8 Flash",
        "priceInput": 0.15,
        "priceOutput": 0.47
      },
      {
        "id": "qwen3.8-max",
        "label": "Qwen3.8 Max",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "deepseek-v4-flash-0731",
        "label": "DeepSeek V4 Flash 0731",
        "priceInput": 0.44,
        "priceOutput": 1.32
      },
      {
        "id": "kimi-k3",
        "label": "Kimi K3",
        "priceInput": 3,
        "priceOutput": 15
      },
      {
        "id": "qwen3.7-flash",
        "label": "Qwen3.7 Flash",
        "priceInput": 0.03,
        "priceOutput": 0.13
      },
      {
        "id": "glm-5.2",
        "label": "GLM-5.2",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "qwen3.7-plus",
        "label": "Qwen3.7 Plus",
        "priceInput": 0.4,
        "priceOutput": 1.6
      },
      {
        "id": "qwen3.7-max",
        "label": "Qwen3.7 Max",
        "priceInput": 2.5,
        "priceOutput": 7.5
      },
      {
        "id": "qwen3.6-flash",
        "label": "Qwen3.6 Flash",
        "priceInput": 0.25,
        "priceOutput": 1.5
      },
      {
        "id": "qwen3.6-27b",
        "label": "Qwen3.6 27B",
        "priceInput": 0.6,
        "priceOutput": 3.6
      },
      {
        "id": "qwen3.6-max-preview",
        "label": "Qwen3.6 Max Preview",
        "priceInput": 1.3,
        "priceOutput": 7.8
      },
      {
        "id": "qwen3.6-35b-a3b",
        "label": "Qwen3.6 35B-A3B",
        "priceInput": 0.375,
        "priceOutput": 2.25
      },
      {
        "id": "qwen3.6-plus",
        "label": "Qwen3.6 Plus",
        "priceInput": 0.5,
        "priceOutput": 3
      },
      {
        "id": "qwen3.5-122b-a10b",
        "label": "Qwen3.5 122B-A10B",
        "priceInput": 0.4,
        "priceOutput": 3.2
      },
      {
        "id": "qwen3.5-27b",
        "label": "Qwen3.5 27B",
        "priceInput": 0.3,
        "priceOutput": 2.4
      },
      {
        "id": "qwen3.5-35b-a3b",
        "label": "Qwen3.5 35B-A3B",
        "priceInput": 0.25,
        "priceOutput": 2
      },
      {
        "id": "qwen3.5-flash",
        "label": "Qwen3.5 Flash",
        "priceInput": 0.1,
        "priceOutput": 0.4
      },
      {
        "id": "qwen3.5-plus",
        "label": "Qwen3.5 Plus",
        "priceInput": 0.4,
        "priceOutput": 2.4
      },
      {
        "id": "qwen3.5-397b-a17b",
        "label": "Qwen3.5 397B-A17B",
        "priceInput": 0.6,
        "priceOutput": 3.6
      },
      {
        "id": "qwen3-max",
        "label": "Qwen3 Max",
        "priceInput": 1.2,
        "priceOutput": 6
      },
      {
        "id": "qwen3-vl-plus",
        "label": "Qwen3-VL Plus",
        "priceInput": 0.2,
        "priceOutput": 1.6
      },
      {
        "id": "qwen3-livetranslate-flash-realtime",
        "label": "Qwen3-LiveTranslate Flash Realtime",
        "priceInput": 10,
        "priceOutput": 10
      },
      {
        "id": "qwen3-omni-flash",
        "label": "Qwen3-Omni Flash",
        "priceInput": 0.43,
        "priceOutput": 1.66
      }
    ],
    "priceInput": 0.15,
    "priceOutput": 0.47
  },
  {
    "id": "groq",
    "name": "Groq",
    "providerName": "groq",
    "baseUrl": "https://api.groq.com/openai/v1",
    "note": "models.dev · Groq（使用 OpenAI 兼容端点）",
    "models": [
      {
        "id": "qwen/qwen3.8-27b",
        "label": "Qwen3.8 27B",
        "priceInput": 0.8,
        "priceOutput": 4
      },
      {
        "id": "qwen/qwen3.6-27b",
        "label": "Qwen3.6 27B",
        "priceInput": 0.6,
        "priceOutput": 3
      },
      {
        "id": "openai/gpt-oss-safeguard-20b",
        "label": "Safety GPT OSS 20B",
        "priceInput": 0.075,
        "priceOutput": 0.3
      },
      {
        "id": "openai/gpt-oss-120b",
        "label": "GPT OSS 120B",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "openai/gpt-oss-20b",
        "label": "GPT OSS 20B",
        "priceInput": 0.075,
        "priceOutput": 0.3
      },
      {
        "id": "meta-llama/llama-prompt-guard-2-22m",
        "label": "Llama Prompt Guard 2 22M",
        "priceInput": 0.03,
        "priceOutput": 0.03
      },
      {
        "id": "meta-llama/llama-prompt-guard-2-86m",
        "label": "Prompt Guard 2 86M",
        "priceInput": 0.04,
        "priceOutput": 0.04
      },
      {
        "id": "allam-2-7b",
        "label": "ALLaM-2-7b",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "llama-3.3-70b-versatile",
        "label": "Llama 3.3 70B",
        "priceInput": 0.59,
        "priceOutput": 0.79
      },
      {
        "id": "llama-3.1-8b-instant",
        "label": "Llama 3.1 8B",
        "priceInput": 0.05,
        "priceOutput": 0.08
      }
    ],
    "priceInput": 0.8,
    "priceOutput": 4
  },
  {
    "id": "mistral",
    "name": "Mistral",
    "providerName": "mistral",
    "baseUrl": "https://api.mistral.ai/v1",
    "note": "models.dev · Mistral（使用 OpenAI 兼容端点）",
    "models": [
      {
        "id": "deepseek-v4-1-flash-1017",
        "label": "DeepSeek V4.1 Flash 1017",
        "priceInput": 0.3,
        "priceOutput": 1.2
      },
      {
        "id": "mistral-large-4",
        "label": "Mistral Large 4",
        "priceInput": 0.7,
        "priceOutput": 2.1
      },
      {
        "id": "mistral-large-4-0-8",
        "label": "Mistral Large 4.0.8",
        "priceInput": 0.7,
        "priceOutput": 2.1
      },
      {
        "id": "zai-glm-5-3-flash",
        "label": "GLM-5.3-Flash",
        "priceInput": 0.15,
        "priceOutput": 0.5
      },
      {
        "id": "zai-glm-5-3",
        "label": "GLM-5.3",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "labs-leanstral-1-5-1",
        "label": "Leanstral 1.5",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "glm-5-2",
        "label": "GLM-5.2",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "zai-glm-5-2",
        "label": "GLM-5.2",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "mistral-medium-2604",
        "label": "Mistral Medium 3.5",
        "priceInput": 1.5,
        "priceOutput": 7.5
      },
      {
        "id": "mistral-medium-latest",
        "label": "Mistral Medium (latest)",
        "priceInput": 1.5,
        "priceOutput": 7.5
      },
      {
        "id": "mistral-small-2603",
        "label": "Mistral Small 4",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "mistral-small-latest",
        "label": "Mistral Small (latest)",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "devstral-2512",
        "label": "Devstral 2",
        "priceInput": 0.4,
        "priceOutput": 2
      },
      {
        "id": "devstral-latest",
        "label": "Devstral 2",
        "priceInput": 0.4,
        "priceOutput": 2
      },
      {
        "id": "labs-devstral-small-2512",
        "label": "Devstral Small 2",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "devstral-medium-latest",
        "label": "Devstral 2 (latest)",
        "priceInput": 0.4,
        "priceOutput": 2
      },
      {
        "id": "ministral-14b-2512",
        "label": "Ministral 3 14B",
        "priceInput": 0.2,
        "priceOutput": 0.2
      },
      {
        "id": "ministral-3b-2512",
        "label": "Ministral 3 3B",
        "priceInput": 0.1,
        "priceOutput": 0.1
      },
      {
        "id": "ministral-8b-2512",
        "label": "Ministral 3 8B",
        "priceInput": 0.15,
        "priceOutput": 0.15
      },
      {
        "id": "mistral-medium-2508",
        "label": "Mistral Medium 3.1",
        "priceInput": 0.4,
        "priceOutput": 2
      },
      {
        "id": "codestral-2508",
        "label": "Codestral 25.08",
        "priceInput": 0.3,
        "priceOutput": 0.9
      },
      {
        "id": "voxtral-small-2507",
        "label": "Voxtral Small",
        "priceInput": 0.1,
        "priceOutput": 0.4
      },
      {
        "id": "voxtral-small-latest",
        "label": "Voxtral Small (latest)",
        "priceInput": 0.1,
        "priceOutput": 0.4
      },
      {
        "id": "mistral-small-2506",
        "label": "Mistral Small 3.2",
        "priceInput": 0.1,
        "priceOutput": 0.3
      }
    ],
    "priceInput": 0.3,
    "priceOutput": 1.2
  },
  {
    "id": "xai",
    "name": "xAI",
    "providerName": "xai",
    "baseUrl": "https://api.x.ai/v1",
    "note": "models.dev · xAI（使用 OpenAI 兼容端点）",
    "models": [
      {
        "id": "grok-4.7",
        "label": "Grok 4.7",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "grok-4.6",
        "label": "Grok 4.6",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "grok-4.5",
        "label": "Grok 4.5",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "grok-4.3",
        "label": "Grok 4.3",
        "priceInput": 1.25,
        "priceOutput": 2.5
      },
      {
        "id": "grok-build-0.1",
        "label": "Grok Build 0.1",
        "priceInput": 1,
        "priceOutput": 2
      },
      {
        "id": "grok-4.20-0309-non-reasoning",
        "label": "Grok 4.20 (Non-Reasoning)",
        "priceInput": 1.25,
        "priceOutput": 2.5
      },
      {
        "id": "grok-4.20-0309-reasoning",
        "label": "Grok 4.20 (Reasoning)",
        "priceInput": 1.25,
        "priceOutput": 2.5
      },
      {
        "id": "grok-4.20-multi-agent-0309",
        "label": "Grok 4.20 Multi-Agent",
        "priceInput": 1.25,
        "priceOutput": 2.5
      }
    ],
    "priceInput": 2,
    "priceOutput": 6
  },
  {
    "id": "cerebras",
    "name": "Cerebras",
    "providerName": "cerebras",
    "baseUrl": "https://api.cerebras.ai/v1",
    "note": "models.dev · Cerebras（使用 OpenAI 兼容端点）",
    "models": [
      {
        "id": "qwen-3.8-27b",
        "label": "Qwen3.8 27B",
        "priceInput": 0.99,
        "priceOutput": 1.49
      },
      {
        "id": "gpt-oss-120b",
        "label": "GPT OSS 120B",
        "priceInput": 0.35,
        "priceOutput": 0.75
      }
    ],
    "priceInput": 0.99,
    "priceOutput": 1.49
  },
  {
    "id": "deepinfra",
    "name": "DeepInfra",
    "providerName": "deepinfra",
    "baseUrl": "https://api.deepinfra.com/v1/openai",
    "note": "models.dev · Deep Infra（使用 OpenAI 兼容端点）",
    "models": [
      {
        "id": "deepseek-ai/DeepSeek-V4.1-Flash-1017",
        "label": "DeepSeek V4.1 Flash 1017",
        "priceInput": 0.2,
        "priceOutput": 0.6
      },
      {
        "id": "XiaomiMiMo/MiMo-V2.6-Flash",
        "label": "MiMo-V2.6-Flash",
        "priceInput": 0.14,
        "priceOutput": 0.28
      },
      {
        "id": "XiaomiMiMo/MiMo-V2.6-Pro",
        "label": "MiMo-V2.6-Pro",
        "priceInput": 0.43,
        "priceOutput": 0.87
      },
      {
        "id": "stepfun-ai/Step-5-Preview",
        "label": "Step 5 Preview",
        "priceInput": 1,
        "priceOutput": 2.7
      },
      {
        "id": "deepseek-ai/DeepSeek-V4.1-Flash",
        "label": "DeepSeek V4.1 Flash",
        "priceInput": 0.2,
        "priceOutput": 0.6
      },
      {
        "id": "tencent/Hy4-preview",
        "label": "Hy4 preview",
        "priceInput": 0.834,
        "priceOutput": 2.501
      },
      {
        "id": "Qwen/Qwen3.8-Flash",
        "label": "Qwen3.8 Flash",
        "priceInput": 0.113,
        "priceOutput": 0.382
      },
      {
        "id": "zai-org/GLM-5.3-Flash",
        "label": "GLM-5.3-Flash",
        "priceInput": 0.15,
        "priceOutput": 0.5
      },
      {
        "id": "deepseek-ai/DeepSeek-V4-Flash-Vision-Exp",
        "label": "DeepSeek V4 Flash Vision Exp",
        "priceInput": 0.44,
        "priceOutput": 1.32
      },
      {
        "id": "Qwen/Qwen3.8-27B",
        "label": "Qwen3.8 27B",
        "priceInput": 0.2,
        "priceOutput": 2.5
      },
      {
        "id": "zai-org/GLM-5.3",
        "label": "GLM-5.3",
        "priceInput": 0.9,
        "priceOutput": 4
      },
      {
        "id": "deepseek-ai/DeepSeek-V4-Pro-0813",
        "label": "DeepSeek V4 Pro 0813",
        "priceInput": 1.3,
        "priceOutput": 2.6
      },
      {
        "id": "Qwen/Qwen3.8-2.4T-A95B",
        "label": "Qwen3.8 2.4T A95B",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "Qwen/Qwen3.8-Max",
        "label": "Qwen3.8 Max",
        "priceInput": 1.65,
        "priceOutput": 4.951
      },
      {
        "id": "deepseek-ai/DeepSeek-V4-Flash-0731",
        "label": "DeepSeek V4 Flash 0731",
        "priceInput": 0.06,
        "priceOutput": 0.18
      },
      {
        "id": "thinkingmachines/Inkling-Small",
        "label": "Inkling Small",
        "priceInput": 0.45,
        "priceOutput": 1.2
      },
      {
        "id": "moonshotai/Kimi-K3",
        "label": "Kimi K3",
        "priceInput": 2.85,
        "priceOutput": 14.25
      },
      {
        "id": "thinkingmachines/Inkling",
        "label": "Inkling",
        "priceInput": 0.95,
        "priceOutput": 4.05
      },
      {
        "id": "tencent/Hy3",
        "label": "Hy3",
        "priceInput": 0.13,
        "priceOutput": 0.53
      },
      {
        "id": "zai-org/GLM-5.2",
        "label": "GLM-5.2",
        "priceInput": 0.75,
        "priceOutput": 2.4
      },
      {
        "id": "moonshotai/Kimi-K2.7-Code",
        "label": "Kimi K2.7 Code",
        "priceInput": 0.68,
        "priceOutput": 3.4
      },
      {
        "id": "anthropic/claude-fable-5",
        "label": "Claude Fable 5",
        "priceInput": 10,
        "priceOutput": 50
      },
      {
        "id": "MiniMaxAI/MiniMax-M3",
        "label": "MiniMax-M3",
        "priceInput": 0.28,
        "priceOutput": 1.1
      },
      {
        "id": "stepfun-ai/Step-3.7-Flash",
        "label": "Step 3.7 Flash",
        "priceInput": 0.2,
        "priceOutput": 1.15
      }
    ],
    "priceInput": 0.2,
    "priceOutput": 0.6
  },
  {
    "id": "fireworks",
    "name": "Fireworks AI",
    "providerName": "fireworks",
    "baseUrl": "https://api.fireworks.ai/inference/v1",
    "note": "models.dev · Fireworks AI",
    "models": [
      {
        "id": "accounts/fireworks/models/minimax-m3p1-flash",
        "label": "MiniMax-M3.1-Flash",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "accounts/fireworks/models/deepseek-v4p1-flash-1017",
        "label": "DeepSeek V4.1 Flash 1017",
        "priceInput": 0.3,
        "priceOutput": 1.2
      },
      {
        "id": "accounts/fireworks/routers/deepseek-flash-latest",
        "label": "DeepSeek Flash Latest",
        "priceInput": 0.3,
        "priceOutput": 1.2
      },
      {
        "id": "accounts/fireworks/routers/deepseek-v4p1-flash-1017-spot",
        "label": "DeepSeek V4.1 Flash 1017 Spot",
        "priceInput": 0.21,
        "priceOutput": 0.84
      },
      {
        "id": "accounts/fireworks/models/muse-spark-open",
        "label": "Muse Spark Open",
        "priceInput": 1.25,
        "priceOutput": 4.25
      },
      {
        "id": "accounts/fireworks/models/ember-1",
        "label": "Ember-1",
        "priceInput": 3,
        "priceOutput": 15
      },
      {
        "id": "accounts/fireworks/models/deepseek-v4p1-flash",
        "label": "DeepSeek V4.1 Flash",
        "priceInput": 0.3,
        "priceOutput": 1.2
      },
      {
        "id": "accounts/fireworks/routers/deepseek-v4p1-flash-spot",
        "label": "DeepSeek V4.1 Flash Spot",
        "priceInput": 0.21,
        "priceOutput": 0.84
      },
      {
        "id": "accounts/fireworks/models/glm-5p3-flash",
        "label": "GLM 5.3 Flash",
        "priceInput": 0.15,
        "priceOutput": 0.5
      },
      {
        "id": "accounts/fireworks/routers/glm-flash-latest",
        "label": "GLM Flash Latest (GLM 5.3 Flash)",
        "priceInput": 0.15,
        "priceOutput": 0.5
      },
      {
        "id": "accounts/fireworks/models/glm-5p3",
        "label": "GLM 5.3",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "accounts/fireworks/routers/glm-5p3-fast",
        "label": "GLM 5.3 Fast",
        "priceInput": 2.1,
        "priceOutput": 6.6
      },
      {
        "id": "accounts/fireworks/routers/glm-5p3-spot",
        "label": "GLM 5.3 Spot",
        "priceInput": 0.98,
        "priceOutput": 3.08
      },
      {
        "id": "accounts/fireworks/routers/glm-fast-latest",
        "label": "GLM 5.3 Fast (Latest)",
        "priceInput": 2.1,
        "priceOutput": 6.6
      },
      {
        "id": "accounts/fireworks/routers/glm-latest",
        "label": "GLM Latest",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "accounts/fireworks/models/qwen3p8-2p4t-a95b",
        "label": "Qwen3.8 2.4T A95B",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b",
        "label": "Nemotron 3.5 Lightning 30B A3B",
        "priceInput": 0.05,
        "priceOutput": 0.2
      },
      {
        "id": "accounts/fireworks/models/qwen3p8-max",
        "label": "Qwen3.8 Max",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "accounts/fireworks/routers/qwen-max-latest",
        "label": "Qwen Max Latest (Qwen3.8 Max)",
        "priceInput": 2,
        "priceOutput": 6
      },
      {
        "id": "accounts/fireworks/models/kimi-k3",
        "label": "Kimi K3",
        "priceInput": 3,
        "priceOutput": 15
      },
      {
        "id": "accounts/fireworks/routers/kimi-fast-latest",
        "label": "Kimi Fast Latest",
        "priceInput": 4.5,
        "priceOutput": 22.5
      },
      {
        "id": "accounts/fireworks/routers/kimi-k3-fast",
        "label": "Kimi K3 Fast",
        "priceInput": 4.5,
        "priceOutput": 22.5
      },
      {
        "id": "accounts/fireworks/routers/kimi-k3-spot",
        "label": "Kimi K3 Spot",
        "priceInput": 2.1,
        "priceOutput": 10.5
      },
      {
        "id": "accounts/fireworks/routers/kimi-latest",
        "label": "Kimi Latest",
        "priceInput": 3,
        "priceOutput": 15
      }
    ],
    "priceInput": 0.15,
    "priceOutput": 0.6
  },
  {
    "id": "nvidia",
    "name": "NVIDIA NIM",
    "providerName": "nvidia",
    "baseUrl": "https://integrate.api.nvidia.com/v1",
    "note": "models.dev · Nvidia",
    "models": [
      {
        "id": "minimaxai/minimax-m3.1-flash",
        "label": "MiniMax-M3.1-Flash",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/nemotron-3.5-super-vl-120b-a12b",
        "label": "Nemotron 3.5 Super VL 120B A12B",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "stepfun-ai/step-5-preview",
        "label": "Step 5 Preview",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "deepseek-ai/deepseek-v4.1-flash",
        "label": "DeepSeek V4.1 Flash",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "z-ai/glm-5.3-flash",
        "label": "GLM-5.3-Flash",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "z-ai/glm-5.3",
        "label": "GLM-5.3",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/nemotron-3.5-lightning-30b-a3b",
        "label": "Nemotron 3.5 Lightning 30B A3B",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "meta/muse-glimmer-30b",
        "label": "Muse Glimmer 30B",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "moonshotai/kimi-k3",
        "label": "Kimi K3",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "poolside/laguna-xs-2.1",
        "label": "Laguna XS 2.1",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "google/diffusiongemma-26b-a4b-it",
        "label": "DiffusionGemma 26B A4B IT",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/nemotron-3-ultra-550b-a55b",
        "label": "Nemotron 3 Ultra 550B A55B",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/nemotron-3.5-content-safety",
        "label": "Nemotron 3.5 Content Safety",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "label": "Nemotron 3 Nano Omni",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "moonshotai/kimi-k2.6",
        "label": "Kimi K2.6",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "google/gemma-4-31b-it",
        "label": "Gemma-4-31B-IT",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/nemotron-voicechat",
        "label": "nemotron-voicechat",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/usdcode",
        "label": "usdcode",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/riva-translate-4b-instruct-v1.1",
        "label": "riva-translate-4b-instruct-v1_1",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/cosmos-reason2-8b",
        "label": "Cosmos Reason2 8B",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/streampetr",
        "label": "streampetr",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
        "label": "llama-3.1-nemotron-safety-guard-8b-v3",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "openai/gpt-oss-20b",
        "label": "GPT OSS 20B",
        "priceInput": 0,
        "priceOutput": 0
      },
      {
        "id": "mistralai/magistral-small-2506",
        "label": "Magistral Small 2506",
        "priceInput": 0,
        "priceOutput": 0
      }
    ],
    "priceInput": 0,
    "priceOutput": 0
  },
  {
    "id": "ollama",
    "name": "Ollama Cloud",
    "providerName": "ollama",
    "baseUrl": "https://ollama.com/v1",
    "note": "models.dev · Ollama Cloud",
    "models": [
      {
        "id": "minimax-m3.1-flash",
        "label": "MiniMax-M3.1-Flash",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "deepseek-v4.1-flash:1017",
        "label": "DeepSeek V4.1 Flash 1017",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "muse-spark-open",
        "label": "Muse Spark Open",
        "priceInput": 1.25,
        "priceOutput": 4.25
      },
      {
        "id": "mistral-large-4",
        "label": "Mistral Large 4",
        "priceInput": 0.68,
        "priceOutput": 2.09
      },
      {
        "id": "mimo-v2.6-flash",
        "label": "MiMo-V2.6-Flash",
        "priceInput": 0.14,
        "priceOutput": 0.28
      },
      {
        "id": "mimo-v2.6-pro",
        "label": "MiMo-V2.6-Pro",
        "priceInput": 0.435,
        "priceOutput": 0.87
      },
      {
        "id": "deepseek-v4.1-flash",
        "label": "DeepSeek V4.1 Flash",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "glm-5.3-flash",
        "label": "GLM-5.3-Flash",
        "priceInput": 0.15,
        "priceOutput": 0.5
      },
      {
        "id": "glm-5.3",
        "label": "GLM-5.3",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "deepseek-v4-pro:0813",
        "label": "DeepSeek V4 Pro 0813",
        "priceInput": 0.66,
        "priceOutput": 1.98
      },
      {
        "id": "kimi-k3",
        "label": "kimi-k3",
        "priceInput": 3,
        "priceOutput": 15
      },
      {
        "id": "glm-5.2",
        "label": "GLM-5.2",
        "priceInput": 1.4,
        "priceOutput": 4.4
      },
      {
        "id": "kimi-k2.7-code",
        "label": "kimi-k2.7-code",
        "priceInput": 0.95,
        "priceOutput": 4
      },
      {
        "id": "nemotron-3-ultra",
        "label": "nemotron-3-ultra",
        "priceInput": 0.1,
        "priceOutput": 3
      },
      {
        "id": "minimax-m3",
        "label": "minimax-m3",
        "priceInput": 0.6,
        "priceOutput": 2.4
      },
      {
        "id": "deepseek-v4-pro",
        "label": "deepseek-v4-pro",
        "priceInput": 0.66,
        "priceOutput": 1.98
      },
      {
        "id": "kimi-k2.6",
        "label": "kimi-k2.6",
        "priceInput": 0.95,
        "priceOutput": 4
      },
      {
        "id": "gemma4:31b",
        "label": "gemma4:31b",
        "priceInput": 0.14,
        "priceOutput": 0.4
      },
      {
        "id": "minimax-m2.7",
        "label": "minimax-m2.7",
        "priceInput": 0.3,
        "priceOutput": 1.2
      },
      {
        "id": "nemotron-3-super",
        "label": "nemotron-3-super",
        "priceInput": 0.015,
        "priceOutput": 0.6
      },
      {
        "id": "nemotron-3-nano:30b",
        "label": "nemotron-3-nano:30b",
        "priceInput": 0.06,
        "priceOutput": 0.24
      },
      {
        "id": "mistral-large-3:675b",
        "label": "mistral-large-3:675b",
        "priceInput": 0.5,
        "priceOutput": 1.5
      },
      {
        "id": "gpt-oss:120b",
        "label": "gpt-oss:120b",
        "priceInput": 0.15,
        "priceOutput": 0.6
      },
      {
        "id": "gpt-oss:20b",
        "label": "gpt-oss:20b",
        "priceInput": 0.07,
        "priceOutput": 0.3
      }
    ],
    "priceInput": 0.15,
    "priceOutput": 0.6
  },
  {
    "id": "stepfun",
    "name": "StepFun",
    "providerName": "stepfun",
    "baseUrl": "https://api.stepfun.com/v1",
    "note": "models.dev · StepFun (China)",
    "models": [
      {
        "id": "step-5-preview",
        "label": "Step 5 Preview",
        "priceInput": 1.04613,
        "priceOutput": 2.98895
      },
      {
        "id": "step-3.7-flash",
        "label": "Step 3.7 Flash",
        "priceInput": 0.20175,
        "priceOutput": 1.21052
      },
      {
        "id": "step-3.5-flash-2603",
        "label": "Step 3.5 Flash 2603",
        "priceInput": 0.10461,
        "priceOutput": 0.31384
      },
      {
        "id": "step-3.5-flash",
        "label": "Step 3.5 Flash",
        "priceInput": 0.10461,
        "priceOutput": 0.31384
      }
    ],
    "priceInput": 1.04613,
    "priceOutput": 2.98895
  }
]

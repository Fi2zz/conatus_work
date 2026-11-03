# inbox 整理报告

- 工作区：`/Users/fitz/REPO/conatus/products/conatus_work/var/workspaces/folder-organize-v01`
- 规则：按「类型/月份」整理到 `inbox/organized/`；冲突文件进 `inbox/quarantine/`；不删除任何文件。
- 冲突处理：删除文件 0 个；原有内容全部保留（移动或隔离）。
- 机器可读明细见 `out/changes.json`。

## 汇总

| 指标 | 数量 |
|---|---|
| moved | 10 |
| quarantined | 1 |
| deleted | 0 |
| operations 合计 | 11 |

校验：`operations = 10 + 1 = 11`，`deleted = 0`。

## 目录结构（整理后）

```
inbox/
├── organized/
│   ├── data/unknown-month/data.csv
│   ├── documents/2026-01/contract-east-2026-01.docx
│   ├── documents/2026-02/contract-east-2026-02.docx
│   ├── images/unknown-month/screenshot.png
│   ├── pdf/2026-01/invoice-2026-01.pdf
│   ├── pdf/2026-02/invoice-2026-02.pdf
│   └── text/unknown-month/
│       ├── README.md
│       ├── deep.txt
│       ├── notes.txt
│       └── old-report.md
├── quarantine/archive/notes.txt
├── archive/            （已空）
├── deep/a/b/           （已空）
└── empty/              （原为空，保留）
```

类型映射：`.docx → documents/`，`.pdf → pdf/`，`.csv → data/`，`.png → images/`，`.md/.txt → text/`。

## 操作明细

| # | 动作 | from | to | sha256 |
|---|---|---|---|---|
| 1 | moved | inbox/contract-east-2026-01.docx | inbox/organized/documents/2026-01/contract-east-2026-01.docx | `37b680e00cba1cdd0e8b70f336ce984e0a73426964b4323e48bb36bb4724f20a` |
| 2 | moved | inbox/contract-east-2026-02.docx | inbox/organized/documents/2026-02/contract-east-2026-02.docx | `2230811ba32b11a9e6331a5e0170df1dbf7b552a5967f10f35731d165f85439d` |
| 3 | moved | inbox/invoice-2026-01.pdf | inbox/organized/pdf/2026-01/invoice-2026-01.pdf | `07fcb564c882df5110100f77cffcb4bc25713b80d3fc17e6639aa7737a1f794b` |
| 4 | moved | inbox/invoice-2026-02.pdf | inbox/organized/pdf/2026-02/invoice-2026-02.pdf | `792af92bb5b4a3e1c680d639f6f8c6e4ce0551eaddc8ca1f0f7d1f8702132318` |
| 5 | moved | inbox/data.csv | inbox/organized/data/unknown-month/data.csv | `492d5ea496056f1a6a6592241032fab764c321596317930b4fa0e1e8bc3b7470` |
| 6 | moved | inbox/screenshot.png | inbox/organized/images/unknown-month/screenshot.png | `cef717c75dd997748d1758820d0a886c81ba017375bdd2e14e8221d1f8b768d9` |
| 7 | moved | inbox/README.md | inbox/organized/text/unknown-month/README.md | `8052a8239d2cea574c5c19a33f0bc13c0217ba9f4f4abea65ab7b77171dcd04a` |
| 8 | moved | inbox/notes.txt | inbox/organized/text/unknown-month/notes.txt | `540473f19ab5978a5ddb7165cc50991ad585077b2683c10fa7b8c20b42d53c12` |
| 9 | moved | inbox/archive/old-report.md | inbox/organized/text/unknown-month/old-report.md | `9a1ede119d42099d49ccc2ce97f488ebb47a95fe833191f739c2b044cca5271a` |
| 10 | moved | inbox/deep/a/b/deep.txt | inbox/organized/text/unknown-month/deep.txt | `62b292df3fecdfd7cae30e6c28f61e1b1ce257b65ee45f972ede2fd7aeb3940b` |
| 11 | quarantined | inbox/archive/notes.txt | inbox/quarantine/archive/notes.txt | `e643658485349a2972b809c7e5ae85e2d2e8a72a6c6cafe6917dfe19f34db0f8` |

sha256 为工具在移动时报告的值，取自文件内容。

## 冲突说明（quarantine）

`inbox/archive/notes.txt` 与 `inbox/notes.txt` 同名但内容不同：

- `inbox/notes.txt` 内容：`会议纪要`
- `inbox/archive/notes.txt` 内容：`归档里的同名纪要`

若两者都进入 `text/unknown-month/`，后者会覆盖前者，因此保留根目录版本在 `organized/`，把 archive 版本移入 `quarantine/archive/notes.txt`（保留原始路径层级，便于回溯）。两个文件内容均未修改、未删除。

## 说明与推断标注

- **月份来源**：仅 `contract-east-2026-01/02.docx` 与 `invoice-2026-01/02.pdf` 的文件名含 `YYYY-MM`，据此建立月份目录；其余文件无月份线索，统一归入 `unknown-month`（**推断**：按「无信息不臆造」原则处理，未使用文件 mtime，因为工具未提供时间戳信息）。
- **递归范围**：`inbox/archive/` 与 `inbox/deep/a/b/` 内文件一并纳入整理，移动后这些目录变空；空目录未删除（约束要求不删除文件，空目录亦未清理）。
- **未处理项**：`inbox/empty/` 原本为空目录，无文件可整理，保持原样。
- **文件字节大小**：docx 35/35 字节、pdf 28/28 字节、csv 8 字节、png 13 字节、notes.txt 13 字节、README.md 32 字节、old-report.md 12 字节、deep.txt 19 字节、quarantine notes.txt 25 字节。这些是很小的占位文件，内容与扩展名不完全匹配（例如 docx/pdf 为占位文本），整理仅按扩展名分类，未对内容做格式转换。

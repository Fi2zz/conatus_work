/// conatus_work —— 基于 conatus 的产品层。
///
/// 分工：conatus 提供可逆效应 + 反应式共效应的运行时、LLM 接入、工具系统与
/// Agent Loop；本包只做产品装配与场景逻辑。
///
/// 产品层边界：不进入 conatus 的伞包 re-export，也不被其它库 import。随功能
/// 落地，装配入口放 `lib/src/`，单文件单职责（沿用 conatus 仓库的约束）。
library;

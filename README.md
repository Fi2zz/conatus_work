# conatus_work

> 基于 [conatus](https://github.com/Fi2zz/conatus) 的产品层。

## 边界

本仓库是**产品**，不是框架模块：

- 它消费 `package:conatus/conatus.dart`，不反向被其它库 import；
- 不进 conatus 伞包的 re-export，不进 conatus 根 `pubspec.yaml` 的依赖清单；
- 独立版本（`version:` 与 conatus 的 0.16.0 冻结无关），独立发布。

判据一句话：假如它被别的项目 `import`，那它应该长成 conatus 的 `packages/` 模块；
否则它留在本仓库。产品里长出来的能力等**第二个消费方**出现再上移成模块。

## 开发

### 在 conatus 工作区内（推荐）

产品以 submodule 形式挂在 conatus 仓库的 `products/conatus_work`，此时依赖解析
到本地 conatus 成员包，改框架源码立刻生效：

```bash
cd <conatus 仓库根>
git submodule update --init
bash tool/setup_code_filter.sh   # 恢复 workspace 形态（filter 配置不在版本控制内）
dart pub get
```

`resolution: workspace` 这一行由 git filter 管理：工作区里生效，`git add` 时自动
注释掉。**不要手动改它**，也不要手动改 `dependency_overrides`。

### 独立 clone

```bash
git clone https://github.com/Fi2zz/conatus_work.git
dart pub get
```

提交态的 pubspec 里 `resolution: workspace` 是注释态，依赖经 git 源拉 conatus
（ref 钉在具体 commit 上）。

## 依赖演进

现在只依赖伞包 `conatus`（单条 git 依赖）。当代码开始直接 `import
'package:conatus_xxx/...'` 时，按 conatus_code 的实证形态扩展：

1. 把被直接 import 的每个模块包**显式**列进 `dependencies`（git + `path:
   packages/conatus_xxx`）——`depend_on_referenced_packages` 要求显式声明；
2. 补 `dependency_overrides`：独立形态靠它对齐 git 源的两种身份，workspace
   形态下由 filter 生成的 `pubspec_overrides.yaml` 清空。

这两步别简化：合并成单条伞包依赖会触发 `depend_on_referenced_packages` 大批
info（`--fatal-infos` 必红），去掉 overrides 则因「git ref 与解析后 SHA 是两种
身份」求解失败。

## 钉版

conatus 仓库更新并推送后，同步 gitlink 之前：

```bash
bash tool/pin_conatus_refs.sh          # 钉到 conatus origin/master 最新
bash tool/pin_conatus_refs.sh <sha>    # 钉到指定 commit
```

提交本仓库 `pubspec.yaml`，让本仓库 CI 立刻验证新组合。

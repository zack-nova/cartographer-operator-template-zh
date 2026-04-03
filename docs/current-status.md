# 当前状态

更新时间：2026-04-03

本文档记录 `cartographer-operator-template-zh` 当前已经实现的能力、已完成的验证、尚未完成的范围，以及建议的下一步开发顺序。

## 当前结论

当前仓库已经达到 `v0.1 可运行原型` 状态：

- 它已经是一个合法的 harness template 仓库；
- 它已经内嵌可执行的 Cartographer bundle；
- 它已经有一条可运行的主工作流：
  `normalize -> validate-input -> prepare -> run`；
- 它已经具备最小测试骨架与构建链；
- 但它还不是“全部 PRD 范围都已完成”的最终版本。

## 已完成

### 1. 模板仓库骨架

已完成并落盘：

- `.harness/template.yaml`
- `.orbit/orbits/workspace.yaml`
- 根 `AGENTS.md`
- `docs/`
- `schema/`
- `tools/`
- `work/` 示例目录

这意味着当前仓库已经具备模板仓库最小结构。

### 2. 内嵌工具链

已完成：

- `tools/cartographer-cli.mjs`
- `tools/run-batch.mjs`
- `tools/cartographer-version.json`

并补齐维护侧源码与构建入口：

- `src/`
- `scripts/build-tools.mjs`
- `package.json`

这意味着安装后的工作区不依赖外部 `cartographer` 仓库即可执行转换。

### 3. 当前可用命令

当前已经支持：

- `normalize`
  - 把 `work/input/request.md` 中明确写出的 repo locator / ref / target slug 规范化为 `work/input/repos.yaml`
- `validate-input`
  - 对 `repos.yaml` 做执行前审阅
  - 发现重复 `target_slug`
  - 提前报告已有输出目录 warning
  - 校验本地 locator 是否真的是 Git 仓库
- `prepare`
  - 自动处理本地/远程 source locator
  - 必要时 clone / checkout
  - 生成 `discovery.json`
  - 生成 `variable-decisions.yaml`
  - 生成 `rolling-decisions.yaml`
  - 生成 `curation-notes.md`
- `run`
  - 读取决策文件
  - 调用内嵌 cartographer bundle
  - 生成 `work/output/`
  - 生成 `work/plans/`
  - 生成 `work/reports/`

### 4. Schema 与校验

已完成：

- 独立 `schema/*.json`
- `Ajv` 驱动的正式 schema 校验

当前已经接入校验的对象包括：

- `repos.yaml`
- `variable-decisions.yaml`
- `rolling-decisions.yaml`
- discovery payload
- repo report
- cartographer version manifest

### 5. 测试与验证

已完成：

- Node 测试骨架
- request normalization 单测
- schema 校验单测
- input validation 单测
- CLI smoke test

当前实际跑通过的检查：

- `npm test`

当前实际跑通过的 smoke：

- `normalize -> prepare -> run`
- `validate-input --json`

## 尚未完成

### 1. PRD 范围内仍未完成的项

以下内容还没有完成，或只完成了一部分：

- 变量判断自动建议层
  - 当前仍以 agent 人工编辑 `variable-decisions.yaml` 为主
- rolling block / rolling file 自动建议层
  - 当前仍以 agent 人工编辑 `rolling-decisions.yaml` 为主
- 更强的输出合法性校验
  - 当前主要校验关键文件存在
  - 尚未做更深入的 manifest 合同检查
- 真实远程仓库 live smoke
  - 代码路径已支持，但尚未跑远程实测
- 真实 `harness install` 集成验证
  - 还没有在真实 install 场景下完整演练
- preflight 报告落盘
  - `validate-input` 当前只输出结果，不写独立审阅文件
- 更细的覆盖确认交互
  - 当前仍是 `--confirm-overwrite`
  - 不是逐仓交互式确认

### 2. 当前已知限制

- `normalize` 不是自由自然语言理解器
  - 它只处理显式 bullet 行中的远程 URL、本地路径、`on/ref/as` 语法
- 如果请求信息不明确，系统会 fail closed，而不是猜测
- 当前批处理能力已经可用，但更偏“保守、可控”的原型实现

## 目前是否完成了开发计划

结论：

- 如果按最近几轮拆出的最小计划来看，主链已经完成；
- 如果按完整 PRD / 技术方案来看，还没有全部完成。

更具体地说：

- `模板骨架`
  - 已完成
- `内嵌 bundle`
  - 已完成
- `结构化输入`
  - 已完成
- `request.md -> repos.yaml` 辅助入口
  - 已完成
- `执行前输入审阅`
  - 已完成
- `prepare / run` 主链
  - 已完成
- `测试与构建基础设施`
  - 已完成
- `更强硬化 / 集成验证 / AI 辅助建议层`
  - 未完成

## 建议的下一步顺序

建议按下面顺序继续：

1. `hardening`
   - 远程仓库 live smoke
   - 更强的 output validation
   - 更细的错误分类
2. `preflight audit`
   - 让 `validate-input` 支持写入审阅报告文件
3. `agent assist`
   - 为变量和 rolling 判断补建议生成能力
4. `real integration`
   - 用真实 `harness install` 场景验证模板
5. `release prep`
   - 首次提交
   - 文档收口
   - 版本与 bundle 更新流程冻结

## 当前建议

当前仓库已经适合进入“首次提交前的收口阶段”，但还不建议宣称“全部产品范围已完成”。

更准确的口径应是：

**当前已经实现了一个可运行、可测试、可用于继续迭代的 v0.1 operator template 主工作流。**

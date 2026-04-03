# Cartographer 中文操作模板

这是一个面向 agent 的 harness 模板，用于在本地工作区内把普通 Git 仓库转换成可复用的 harness 模板。

请先阅读 [AGENTS.md](/Users/miles/Code/Vocation/cartographer-operator-template-zh/AGENTS.md)。当前主流程是：

1. 把用户意图整理成 `work/input/repos.yaml`
2. 运行 `validate-input`，提前发现重复 `target_slug` 和输出目录冲突
3. 运行 `prepare`，解析 source 并生成 discovery / curation 文件
4. 补全变量和 rolling 判断
5. 运行 `run`，生成输出与报告

开发说明：

- `tools/` 中是安装后直接运行的已提交 bundle。
- `src/`、`scripts/`、`tests/` 是维护这套 bundle 的源码与测试目录。
- 更新内嵌工具后，请执行 `npm install`、`npm run build`、`npm test`。
- 如果输入来自自然语言，请优先使用 `node ./tools/run-batch.mjs normalize --request work/input/request.md --output work/input/repos.yaml`。
- 在 clone 或 materialize 之前，先运行 `node ./tools/run-batch.mjs validate-input --input work/input/repos.yaml --json`。
- 当前实现范围与剩余工作记录在 [docs/current-status.md](/Users/miles/Code/Vocation/cartographer-operator-template-zh/docs/current-status.md)。

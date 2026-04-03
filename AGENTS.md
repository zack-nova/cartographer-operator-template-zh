# Cartographer 中文操作模板

开始工作前请按顺序阅读这些文件：

1. `docs/product.md`
2. `docs/workflow.md`
3. `docs/input-contract.md`
4. `docs/output-contract.md`
5. `docs/safety-rules.md`
6. `docs/reporting.md`

执行规则：

- 如果用户只给了自然语言，先把原始请求写入 `work/input/request.md`，再整理成 `work/input/repos.yaml`。
- 当请求里已经有明确的 repo locator 时，优先使用 `node ./tools/run-batch.mjs normalize --request work/input/request.md --output work/input/repos.yaml`。
- 不要编造缺失的 repo locator、ref、变量值或 rolling 判断。
- 不要执行源仓库脚本，也不要安装源仓库依赖。
- `work/analysis/`、`work/plans/`、`work/reports/` 属于 operator 运行态文件。它们在工作区可见，但不属于任何生成出的目标模板。
- 如果 `repos.yaml` 是手工编辑或由自然语言整理而来，在执行 `prepare` 之前先运行 `node ./tools/run-batch.mjs validate-input --input work/input/repos.yaml --json`。
- 使用 `node ./tools/run-batch.mjs prepare --input work/input/repos.yaml` 解析 source；如果是远程仓库会自动 clone，需要 checkout 时也会自动处理。
- 在审阅并更新 `variable-decisions.yaml` 与 `rolling-decisions.yaml` 之后，再运行 `node ./tools/run-batch.mjs run --input work/input/repos.yaml`。
- 只有在用户明确确认的前提下，才允许覆盖已有的 `work/output/<target-slug>/`；此时才传入覆盖参数。

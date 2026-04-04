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
- `normalize` 可以接受单句里唯一且明确的 repo locator，但 bullet 列表仍然是最稳定的输入形态。
- 不要编造缺失的 repo locator、ref、变量值或 rolling 判断。
- 不要执行源仓库脚本，也不要安装源仓库依赖。
- `work/analysis/`、`work/plans/`、`work/reports/` 属于 operator 运行态文件。它们在工作区可见，但不属于任何生成出的目标模板。
- 如果 `repos.yaml` 是手工编辑或由自然语言整理而来，在执行 `prepare` 之前先运行 `node ./tools/run-batch.mjs validate-input --input work/input/repos.yaml --json`。
- `repos.yaml` 里的相对路径按 `repos.yaml` 自身所在目录解析；推荐把文件固定放在 `work/input/repos.yaml`，并使用模板提供的默认相对路径。
- 使用 `node ./tools/run-batch.mjs prepare --input work/input/repos.yaml` 解析 source；如果是远程仓库会自动 clone，需要 checkout 时也会自动处理。
- 对公开 GitHub 仓库，如果 SSH locator 不可用，可改成等价 HTTPS 只读 locator 重试。
- 在审阅并更新 `variable-decisions.yaml` 与 `rolling-decisions.yaml` 之后，再运行 `node ./tools/run-batch.mjs run --input work/input/repos.yaml`。
- 如果根入口文档在源仓库里是 symlink，生成目标模板时会解引用为正文内容，而不是保留链接目标字符串。
- 只有在用户明确确认的前提下，才允许覆盖已有的 `work/output/<target-slug>/`；此时才传入覆盖参数。

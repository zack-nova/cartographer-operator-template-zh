# 报告与审计

每个仓库必须保留这些审计产物：

- `work/analysis/<batch-id>/<target-slug>/discovery.json`
- `work/analysis/<batch-id>/<target-slug>/variable-decisions.yaml`
- `work/analysis/<batch-id>/<target-slug>/rolling-decisions.yaml`
- `work/analysis/<batch-id>/<target-slug>/curation-notes.md`
- `work/plans/<batch-id>/<target-slug>.json`
- `work/reports/<batch-id>/<target-slug>.json`

每个批次必须保留：

- `work/reports/<batch-id>/summary.md`

单仓库报告必须记录 source locator、ref、输出路径、最终状态和失败原因。

执行前审阅：

- `validate-input` 是只读的 preflight 命令
- 它会在 `prepare` 或 `run` 之前报告批次级 warning，例如已有输出目录
- 它不会在 `work/` 下创建运行态产物

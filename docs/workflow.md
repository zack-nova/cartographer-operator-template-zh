# 工作流

标准流程：

1. 如果有必要，先把原始任务描述记录到 `work/input/request.md`
2. 把任务整理成 `work/input/repos.yaml`
   如果请求里已经包含明确的 repo locator，可使用 `node ./tools/run-batch.mjs normalize --request work/input/request.md --output work/input/repos.yaml`
3. 运行 `node ./tools/run-batch.mjs validate-input --input work/input/repos.yaml --json`
4. 运行 `node ./tools/run-batch.mjs prepare --input work/input/repos.yaml`
5. 审阅 `work/analysis/<batch-id>/<target-slug>/`
6. 补全变量与 rolling 判断
7. 运行 `node ./tools/run-batch.mjs run --input work/input/repos.yaml`
8. 如果目标输出目录已经存在，只有在明确复核后才带 `--confirm-overwrite` 重跑
9. 审阅 `work/output/` 与 `work/reports/` 中的结果

agent 的高价值工作：

- 识别哪些固定字面量应该提取为变量
- 识别哪些 rolling block / rolling file 不应该固化进复用模板正文
- 在 `curation-notes.md` 中解释有歧义的判断
- 当 `normalize` 无法安全提取 locator 或 ref 时，不要猜测，改为手工编辑 `repos.yaml`

实现说明：

- 远程 locator 会自动 clone 到批次级缓存目录
- 本地 locator 在未指定 `ref` 时直接读取原仓库
- 本地 locator 一旦指定了 `ref`，会先 clone 到批次缓存再 checkout，避免污染源仓库
- `validate-input` 会在执行前发现重复 `target_slug` 并报告已有输出目录 warning

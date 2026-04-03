# 输入约定

主输入文件：

- `work/input/repos.yaml`

规则：

- 必须包含 `schema_version`
- `defaults.auto_approve` 与 `defaults.continue_on_error` 只允许批次级配置
- `repos[]` 必须包含 `repo_locator` 与 `target_slug`
- `repo_locator` 可以是本地 Git 路径，也可以是远程 Git locator
- `ref` 可选；未提供时使用源仓库默认分支
- 当 `repo_locator` 是本地路径且指定了 `ref` 时，runner 会先 clone 到批次缓存，再执行 checkout，不会原地改动源仓库
- 所有可执行输入文件都会先按已提交的 `schema/*.json` 进行校验

推荐的次级输入：

- `work/input/request.md`

这个文件是可选的，用来保存原始任务描述；它本身不是可执行输入。

工具说明：

- `node ./tools/run-batch.mjs normalize --request <request.md> --output <repos.yaml>` 可以把明确的项目列表整理成可执行输入
- normalizer 只提取明确的远程 URL 和本地路径；如果请求有歧义，会直接失败，不会编造值
- `node ./tools/run-batch.mjs validate-input --input <repos.yaml> --json` 会做 schema 之外的语义检查，例如重复 `target_slug` 和输出目录冲突预警

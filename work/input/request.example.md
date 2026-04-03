# 任务请求

请把这些仓库转换成可复用的 harness 模板。

normalizer 当前支持的明确写法：

- `git@github.com:org/repo-a.git` on `main`
- `https://github.com/org/repo-b.git` ref `release/docs`
- `/absolute/path/to/local-repo`
- `/absolute/path/to/local-repo` as `local-repo-custom`

不要编造缺失信息。如果 repo locator 或 ref 不清楚，执行前先停下来确认。

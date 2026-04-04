# 任务请求

请把这些仓库转换成可复用的 harness 模板。

normalizer 当前支持的明确写法：

- `git@github.com:org/repo-a.git` on `main`
- `https://github.com/org/repo-b.git` ref `release/docs`
- `/absolute/path/to/local-repo`
- `/absolute/path/to/local-repo` as `local-repo-custom`

如果整份请求里只有一个明确 locator，也可以直接写在普通句子里，例如：

帮我把 `https://github.com/org/repo-c.git` 这个仓库里的 harness 文档转换为 harness 模板。

不要编造缺失信息。如果 repo locator 或 ref 不清楚，执行前先停下来确认。

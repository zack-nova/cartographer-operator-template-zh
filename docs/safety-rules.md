# 安全规则

硬规则：

- 不要执行源仓库脚本
- 不要安装源仓库依赖
- 不要自动向远程仓库 push
- 不要编造缺失的 repo locator、ref、变量或 rolling 判断
- 未经明确确认，不要覆盖已有的 `work/output/<target-slug>/`
- 不要在用户提供的本地仓库里直接切分支或 checkout ref；当需要非默认 ref 时，先 clone 到批次缓存
- 每次批处理结束后默认清理 clone cache；只有在明确调试需求下才例外

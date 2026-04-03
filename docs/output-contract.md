# 输出约定

生成出的目标模板位于：

- `work/output/<target-slug>/`

每个成功输出都必须包含：

- `.harness/template.yaml`
- `.orbit/orbits/workspace.yaml`
- `AGENTS.md`

Operator 运行态文件位于：

- `work/analysis/`
- `work/plans/`
- `work/reports/`

这些运行态文件在工作区内可见，但绝不能复制进生成的目标模板。

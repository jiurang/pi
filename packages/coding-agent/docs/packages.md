> pi can help you create pi packages. Ask it to bundle your extensions, skills, prompt templates, or themes.
> pi 可以帮你创建 pi 包。你可以让它把你的扩展(extensions)、技能(skills)、提示词模板(prompt templates)或主题(themes)打包起来。

# Pi Packages Pi 包

Pi packages bundle extensions, skills, prompt templates, and themes so you can share them through npm or git. A package can declare resources in `package.json` under the `pi` key, or use conventional directories.
Pi 包将扩展、技能、提示词模板和主题打包在一起,便于你通过 npm 或 git 分享。包可以在 `package.json` 的 `pi` 键下声明资源,也可以使用约定目录。

## Table of Contents 目录

- [Install and Manage](#install-and-manage)
  安装与管理
- [Package Sources](#package-sources)
  包来源
- [Creating a Pi Package](#creating-a-pi-package)
  创建 Pi 包
- [Package Structure](#package-structure)
  包结构
- [Dependencies](#dependencies)
  依赖
- [Package Filtering](#package-filtering)
  包过滤
- [Enable and Disable Resources](#enable-and-disable-resources)
  启用与禁用资源
- [Scope and Deduplication](#scope-and-deduplication)
  作用域与去重

## Install and Manage 安装与管理

> **Security:** Pi packages run with full system access. Extensions execute arbitrary code, and skills can instruct the model to perform any action including running executables. Review source code before installing third-party packages.
> **安全提示:** Pi 包以完整的系统访问权限运行。扩展会执行任意代码,技能则可以指示模型执行任何操作,包括运行可执行文件。安装第三方包之前请先审阅其源代码。

```bash
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install https://github.com/user/repo  # raw URLs work too
pi install /absolute/path/to/package
pi install ./relative/path/to/package

pi remove npm:@foo/bar
pi list                     # show installed packages from settings
pi update                   # update pi only
pi update --all             # update pi, update packages, and reconcile pinned git refs
pi update --extensions      # update packages and reconcile pinned git refs only
pi update --models          # refresh model catalogs only
pi update --self            # update pi only
pi update --self --force    # reinstall pi even if current
pi update npm:@foo/bar      # update one package
pi update --extension npm:@foo/bar
```

These commands manage pi packages and `pi update` can update the pi CLI installation. To uninstall pi itself, see [Quickstart](quickstart.md#uninstall).
这些命令用于管理 pi 包,其中 `pi update` 还能更新 pi CLI 自身的安装。若要卸载 pi 本身,请参阅 [Quickstart](quickstart.md#uninstall)。

By default, `install` and `remove` write to user settings (`~/.pi/agent/settings.json`). Use `-l` to write to project settings (`.pi/settings.json`) instead. Project settings can be shared with your team, and pi installs any missing packages automatically on startup after the project is trusted.
默认情况下,`install` 和 `remove` 会写入用户设置(`~/.pi/agent/settings.json`)。使用 `-l` 可改为写入项目设置(`.pi/settings.json`)。项目设置可以与团队共享,在项目被信任后,pi 会在启动时自动安装缺失的包。

To try a package without installing it, use `--extension` or `-e`. This installs to a temporary directory for the current run only:
若想试用某个包而不进行安装,请使用 `--extension` 或 `-e`。它只会将包安装到临时目录,仅对本次运行生效:

```bash
pi -e npm:@foo/bar
pi -e git:github.com/user/repo
```

## Package Sources 包来源

Pi accepts three source types in settings and `pi install`.
在设置文件和 `pi install` 中,Pi 支持三种来源类型。

### npm

```
npm:@scope/pkg@1.2.3
npm:pkg
```

- Versioned specs are pinned and skipped by package updates (`pi update --extensions`, `pi update --all`).
  带版本号的来源会被固定(pinned),包更新时会被跳过(`pi update --extensions`、`pi update --all`)。
- User installs go under `~/.pi/agent/npm/`.
  用户级安装位于 `~/.pi/agent/npm/` 下。
- Project installs go under `.pi/npm/`.
  项目级安装位于 `.pi/npm/` 下。
- Set `npmCommand` in `settings.json` to pin npm package lookup and install operations to a specific wrapper command such as `mise` or `asdf`.
  在 `settings.json` 中设置 `npmCommand`,可将 npm 包的查找与安装操作固定到指定的包装命令,例如 `mise` 或 `asdf`。

Example:
示例:

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

### git

```
git:github.com/user/repo@v1
git:git@github.com:user/repo@v1
https://github.com/user/repo@v1
ssh://git@github.com/user/repo@v1
```

- Without `git:` prefix, only protocol URLs are accepted (`https://`, `http://`, `ssh://`, `git://`).
  不带 `git:` 前缀时,只接受带协议的 URL(`https://`、`http://`、`ssh://`、`git://`)。
- With `git:` prefix, shorthand formats are accepted, including `github.com/user/repo` and `git@github.com:user/repo`.
  带 `git:` 前缀时,可接受简写格式,包括 `github.com/user/repo` 和 `git@github.com:user/repo`。
- HTTPS and SSH URLs are both supported.
  HTTPS 和 SSH 两种 URL 都受支持。
- SSH URLs use your configured SSH keys automatically (respects `~/.ssh/config`).
  SSH URL 会自动使用你已配置的 SSH 密钥(遵循 `~/.ssh/config`)。
- For non-interactive runs (for example CI), you can set `GIT_TERMINAL_PROMPT=0` to disable credential prompts and set `GIT_SSH_COMMAND` (for example `ssh -o BatchMode=yes -o ConnectTimeout=5`) to fail fast.
  对于非交互式运行(例如 CI),可以设置 `GIT_TERMINAL_PROMPT=0` 关闭凭据提示,并设置 `GIT_SSH_COMMAND`(例如 `ssh -o BatchMode=yes -o ConnectTimeout=5`)以便快速失败。
- Refs are pinned tags or commits. `pi update --extensions` and `pi update --all` do not move them to newer refs, but they do reconcile an existing clone to the configured ref.
  ref 是被固定的 tag 或 commit。`pi update --extensions` 和 `pi update --all` 不会将其更新到更新的 ref,但会把已有的克隆同步到所配置的 ref。
- Use `pi install git:host/user/repo@new-ref` to update settings and move an existing package to a new pinned ref.
  使用 `pi install git:host/user/repo@new-ref` 可更新设置,并将已有的包切换到新的固定 ref。
- Cloned to `~/.pi/agent/git/<host>/<path>` (global) or `.pi/git/<host>/<path>` (project).
  克隆到 `~/.pi/agent/git/<host>/<path>`(全局)或 `.pi/git/<host>/<path>`(项目)。
- When reconciliation changes the checkout, pi resets and cleans the clone, then runs `npm install` if `package.json` exists.
  当同步操作改变了检出内容时,pi 会重置并清理该克隆,若存在 `package.json` 则随后运行 `npm install`。

**SSH examples:**
**SSH 示例:**
```bash
# git@host:path shorthand (requires git: prefix)
pi install git:git@github.com:user/repo

# ssh:// protocol format
pi install ssh://git@github.com/user/repo

# With version ref
pi install git:git@github.com:user/repo@v1.0.0
```

### Local Paths 本地路径

```
/absolute/path/to/package
./relative/path/to/package
```

Local paths point to files or directories on disk and are added to settings without copying. Relative paths are resolved against the settings file they appear in. If the path is a file, it loads as a single extension. If it is a directory, pi loads resources using package rules.
本地路径指向磁盘上的文件或目录,会被直接加入设置而不进行复制。相对路径以其所在的设置文件为基准解析。如果路径指向文件,则作为单个扩展加载;如果指向目录,则 pi 会按包的规则加载其中的资源。

## Creating a Pi Package 创建 Pi 包

Add a `pi` manifest to `package.json` or use conventional directories. Include the `pi-package` keyword for discoverability.
在 `package.json` 中添加 `pi` 清单(manifest),或使用约定目录。请加上 `pi-package` 关键字以便被发现。

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Paths are relative to the package root. Arrays support glob patterns and `!exclusions`.
路径相对于包根目录。数组支持 glob 通配模式和 `!exclusions` 排除写法。

### Gallery Metadata 展示库元数据

The [package gallery](https://pi.dev/packages) displays packages tagged with `pi-package`. Add `video` or `image` fields to show a preview:
[package gallery](https://pi.dev/packages) 会展示带有 `pi-package` 标签的包。添加 `video` 或 `image` 字段可显示预览:

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

- **video**: MP4 only. On desktop, autoplays on hover. Clicking opens a fullscreen player.
  **video**:仅支持 MP4。在桌面端悬停时自动播放,点击可打开全屏播放器。
- **image**: PNG, JPEG, GIF, or WebP. Displayed as a static preview.
  **image**:支持 PNG、JPEG、GIF 或 WebP,作为静态预览图展示。

If both are set, video takes precedence.
若两者都设置了,则以 video 优先。

## Package Structure 包结构

### Convention Directories 约定目录

If no `pi` manifest is present, pi auto-discovers resources from these directories:
如果没有 `pi` 清单,pi 会从以下目录自动发现资源:

- `extensions/` loads `.ts` and `.js` files
  `extensions/` 加载 `.ts` 和 `.js` 文件
- `skills/` recursively finds `SKILL.md` folders and loads top-level `.md` files as skills
  `skills/` 递归查找包含 `SKILL.md` 的文件夹,并将顶层的 `.md` 文件作为技能加载
- `prompts/` loads `.md` files
  `prompts/` 加载 `.md` 文件
- `themes/` loads `.json` files
  `themes/` 加载 `.json` 文件

## Dependencies 依赖

Third party runtime dependencies belong in `dependencies` in `package.json`. Dependencies that do not register extensions, skills, prompt templates, or themes also belong in `dependencies`. When pi installs a package from npm or git, it runs `npm install`, so those dependencies are installed automatically.
第三方运行时依赖应写入 `package.json` 的 `dependencies` 中。那些不注册扩展、技能、提示词模板或主题的依赖同样应放在 `dependencies` 中。当 pi 从 npm 或 git 安装包时会运行 `npm install`,因此这些依赖会被自动安装。

Pi bundles core packages for extensions and skills. If you import any of these, list them in `peerDependencies` with a `"*"` range and do not bundle them: `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`.
Pi 自带了供扩展和技能使用的核心包。如果你引用了其中任何一个,请在 `peerDependencies` 中以 `"*"` 版本范围列出,并且不要将它们打包进来:`@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`、`typebox`。

Other pi packages must be bundled in your tarball. Add them to `dependencies` and `bundledDependencies`, then reference their resources through `node_modules/` paths. Pi loads packages with separate module roots, so separate installs do not collide or share modules.
其他 pi 包必须打包进你的 tarball 中。请将它们同时加入 `dependencies` 和 `bundledDependencies`,然后通过 `node_modules/` 路径引用其资源。Pi 会以彼此独立的模块根(module root)加载各个包,因此不同的安装之间不会冲突,也不会共享模块。

Example:
示例:

```json
{
  "dependencies": {
    "shitty-extensions": "^1.0.1"
  },
  "bundledDependencies": ["shitty-extensions"],
  "pi": {
    "extensions": ["extensions", "node_modules/shitty-extensions/extensions"],
    "skills": ["skills", "node_modules/shitty-extensions/skills"]
  }
}
```

## Package Filtering 包过滤

Filter what a package loads using the object form in settings:
在设置中使用对象形式,可以过滤某个包所加载的内容:

```json
{
  "packages": [
    "npm:simple-pkg",
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": ["+themes/legacy.json"]
    }
  ]
}
```

`+path` and `-path` are exact paths relative to the package root.
`+path` 和 `-path` 是相对于包根目录的精确路径。

- Omit a key to load all of that type.
  省略某个键表示加载该类型的全部资源。
- Use `[]` to load none of that type.
  使用 `[]` 表示不加载该类型的任何资源。
- `!pattern` excludes matches.
  `!pattern` 用于排除匹配项。
- `+path` force-includes an exact path.
  `+path` 强制包含某个精确路径。
- `-path` force-excludes an exact path.
  `-path` 强制排除某个精确路径。
- Filters layer on top of the manifest. They narrow down what is already allowed.
  过滤器叠加在清单之上,只会在已允许的范围内进一步收窄。

## Enable and Disable Resources 启用与禁用资源

Use `pi config` to enable or disable extensions, skills, prompt templates, and themes from installed packages and local directories. `pi config` starts in global settings (`~/.pi/agent/settings.json`); press Tab to switch between global and project-local modes. Use `pi config -l` to start in project overrides (`.pi/settings.json`) with inherited global resources dimmed.
使用 `pi config` 可以启用或禁用来自已安装包和本地目录的扩展、技能、提示词模板与主题。`pi config` 默认进入全局设置(`~/.pi/agent/settings.json`);按 Tab 键可在全局模式与项目本地模式之间切换。使用 `pi config -l` 则从项目级覆盖设置(`.pi/settings.json`)开始,继承自全局的资源会以暗色显示。

## Scope and Deduplication 作用域与去重

Packages can appear in both global and project settings. If the same package appears in both, the project entry wins unless the project entry has `autoload: false`, in which case it is applied as a delta over the global entry. Identity is determined by:
包可以同时出现在全局设置和项目设置中。如果同一个包在两者中都出现,则以项目条目为准;除非该项目条目设置了 `autoload: false`,此时它会作为增量(delta)叠加到全局条目之上。包的身份标识由以下方式确定:

- npm: package name
  npm:包名
- git: repository URL without ref
  git:不含 ref 的仓库 URL
- local: resolved absolute path
  local:解析后的绝对路径

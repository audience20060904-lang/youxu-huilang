# 幽墟回廊 · 项目交接文档

**这个文件是给 Claude 看的。** 新开一个会话时它会被自动读取，所以用户不需要重复交代背景。
改动了下面记录的任何事实（地址、流程、决定、坑），**请同步更新这个文件**。

用户用中文交流，回复用中文。

---

## 一句话

一个用背单词打怪的地牢 Roguelike，纯静态网页，没有构建步骤，没有依赖。
答对一题砍怪一刀，答错挨一口。50 层，词汇从 CEFR A1 爬到 B1。

## 三个地址

| 用途 | 地址 |
| --- | --- |
| 代码仓库（唯一源） | https://github.com/audience20060904-lang/youxu-huilang |
| 线上网站 | https://audience20060904-lang.github.io/youxu-huilang/ |
| 废弃的旧副本 | `https://claude.ai/artifact/AUmzcwqghnNKk9hGFYxhJL` |

## 已经定下来的事（别再重新讨论）

1. **GitHub 是唯一源。** 这个仓库的 `main` 分支就是全部真相。
2. **不要再碰那个 Artifact。** 游戏最早是作为 Claude Artifact 写的，代码从那里导出后推进了本仓库。
   那个 Artifact 现在是一份冻结的旧副本，用户已决定弃用它 —— **不要往那边同步，不要republish，
   也不要主动提议用它**。（用户没说要删，所以也别删。）
3. **用户不自己改代码。** 工作方式是：用户提需求 → Claude 在本仓库改 → 提交并推到 `main` → 网站自动更新。
   不要把「你去 GitHub 网页上点开文件改一下」当成交付。
4. **网站已经跑通了**，用户确认能正常打开。别再问「Pages 开了吗」。
5. **改完自动上线，不用问。**（用户 2026-09 明确授权）每次改动做完、自测过，就直接：
   提交 → 推到 `main` → 用 Actions API 确认部署 `conclusion: success` → 在回复里带一句上线结果。
   **不要再问「要不要合并到 main / 要不要上线」**，也不要停在某个开发分支上等许可。
   - 会话被要求在某个 `claude/...` 分支上开发时：照样在那个分支上提交和推送，
     然后把它合进 `main` 再推 `main`（`git checkout main && git merge --ff-only <分支> && git push origin main`）。
     分支只是工作区，**`main` 才是上线口**。
   - 例外只有两种，这时候先问：改动会**动坏现有存档**（换 localStorage 键、改存档格式），
     或者用户自己说了「先别上线」。
   - 自测跑不过、或者部署失败，就别硬推/别当成功报 —— 先修，或者如实说卡在哪。
6. **别堆提示文字。**（用户 2026-09）"这个游戏不需要太多提示"。界面上的大段说明能删就删，
   玩法说明（`veilHelp`）里集中讲一次就够。遗物页原来那块「遗物怎么来」已经整块删掉了，别加回来。
   新功能就地给一行短提示即可，不要再写一屏 note。

## 文件结构

`index.html` 按固定顺序加载脚本，**顺序不能乱**（`util` 提供全局函数 → `words`/`content` 依赖它 → `game` 依赖全部）：

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面骨架：四个标签页（冒险/信息/遗物/设置）+ 十个弹层 |
| `style.css` | 全部样式，颜色变量在 `:root` |
| `util.js` | 全局小工具（随机、localStorage 存档、语音朗读），必须最先加载 |
| `words-a1.js` | 词库 430 词 + 派生索引 `WMAP` / `BYCAT` / `BYLV` |
| `content.js` | 数值配置：章节 `CHAPTER`、怪物 `FOES`/`BOSS`、遗物 `RELICS`。**调平衡只改这个文件** |
| `art.js` | SVG 美术（怪物剪影、主角、金币 `COIN`、粒子碎屑），剪影用 `currentColor`，颜色交给 CSS |
| `game.js` | 全部游戏逻辑，约 1900 行 |

## 常见改动

- **加单词** → `words-a1.js` 的 `WORDS` 数组，格式 `["英文","中文","类别",难度]`，四个字段都要给。
  难度 1=A1 2=A2 3=B1。类别必须在同文件的 `CAT_CN` 里有中文名。
  ⚠️ **英文不能重复** —— `WMAP` 按英文做键，重了会被静默覆盖，不报错。
- **调数值**（血量/伤害/掉率/成长曲线）→ 全在 `content.js` 的 `CHAPTER` 和 `FOES` 里。
  50 层的成长曲线很敏感，改之前先算一遍（文件里有注释说明为什么经验是每 3 层 +1）。
- **加遗物** → `content.js` 的 `RELICS` 加一条，**然后必须在 `game.js` 里加对应的 `hasRelic("id")` 分支**，
  两边不同步的话遗物会存在但没效果。
  数值规矩：**全是整数加减，整个伤害公式只有「暴击 ×2」一个乘区**，不要引入第二个乘法。

## 界面上几条已经定下来的规矩

- **镜头永远居中。** `camera()` **不夹地图边界**（以前夹了，走到边缘人就跑到画面边上）。
  走到边缘时取景窗会露出地图外面，所以 `.stage` 的背景色跟未探索格子 `--unseen` 一样，看不出接缝。
  **别再把 clamp 加回来。**
- **下楼要确认。** 踩上 ▼ 不再直接掉下去，先弹 `veilStair`（`askStair()`）。
  选「再待一会儿」就留在阶梯上，**再点一下脚下那格**会重新弹（`#map` 的 click 里有这一分支）。
- **「押注」这个词在界面上已经全改成「冒险」**（代码里的标识符还是 `wager` / `B.wager`，没改）。
  地图下面那行 `#mapTools` 里的「锁定冒险」= `OPT.lock`，开着就每题自动 `B.wager = true`（拼写题除外）。
  冒险按钮上的两行字必须走 `setWagerLabel()` —— **直接 `textContent =` 会把里面的 `<em>` 干掉**（踩过）。
- **设置页的「本地存档文件」和「跨设备导出码」两个面板是 `hidden` 的**（`#panelSaveFile` / `#panelCode`）。
  用户要求藏起来，代码全留着，去掉 `hidden` 就回来 —— 别因为"没用到"就删掉那套逻辑。
- **战斗四个选项是 2×2 的正方块**（`.opts` / `.opt`，`aspect-ratio:1`，宽度 `min(100%, 40vh)` 卡住高度），
  序号 1234 是左上角的小方块。⚠️ 设置页的复选框以前也叫 `.opt` 且定义在后面，偷偷覆盖了战斗选项的
  `display/padding` —— 已改名 `.setopt`，**别再让这两个重名**。
- **捡东西有粒子**：`fxGold()` 从那一格飞到顶上的「金」，`fxRelic()` 从当前弹层飞到底部「遗物」标签，
  落点自己跳一下（`.pop`）。都走 `fxFly()`，纯装饰、挂在 body 上、飞完就删；
  系统开了「减少动态效果」（`REDUCE_MOTION`）就整段跳过。
- **泉水要先问**（`veilSpring` / `openSpring()`）：不喝就留在原地，回头还能来；满血时「喝下」按钮禁用。
- **连击存在 `P.combo` 上，跨怪物保留**（以前是 `B.combo`，每场清零）。只有答错（长链减半）、
  倒下、回主城才清。它跟着 `P` 进续玩档，`resumeRun` 有老档兜底。
- **合成是玩家自己挑的**：遗物页的合成面板只有两个按钮 ——「选择」（`fuseToggleMode`，进/退挑选状态）
  和「合成」（`fuseGo`）。挑选状态下整张遗物卡可点（`fusePick`），只能挑同一品质、最多 3 件，
  神圣不能当材料；分解按钮这时收起来免得误触。换到哪一件高品质仍是随机。
  以前那套「按品质列四行、自动吃掉前三件」的 `fuserow` / `fuseRelics(rar)` 已经删了。
- **阶梯开在最后一只怪倒下的地方**（`closeBattleWin()` 里清空时改写 `G.stair`）——
  清完层不用再满地图找那个 ▼。怪站的一定是地板，所以位置永远合法。
- **图鉴默认全解锁**：遗物和词汇都直接显示名字/效果/释义，没拿过、没遇到的只是**没有计数**
  （显示「还没拿到过」「还没遇到」）。以前那套 `▨▨` 遮挡已经删了，别加回来。
- **遗物上限 `RELIC_MAX = 15`**（原来 10）。带满时遗物页很长 ——
  `#viewRelic` 必须在 `overflow-y:auto` 那条规则里，否则底下的合成面板会被挤没。
  ⚠️ 这条以前写的是早就改名的 `#viewBag`，白瞎了很久。
- **怪倒下没有中间画面**：`finishBattle(true)` 直接 `closeBattleWin()` ——
  既没有「收取战利品」按钮，也不再弹「XX 倒下了」那一屏。看清最后一题释义的时间
  留在 `answer()` 那边（最后一击后延时 760ms 再结束）。`B.won` 是防重入的闸。
- **战斗窗必须整屏放得下**（用户要求"能在屏幕里读完所有信息"）：`.battle` 里立绘、题面字号、
  选项方块、内外间距**全部用 `clamp(最小, xvh, 最大)`**，选项容器还有个 318px 的像素上限 ——
  高屏上方块再长大反而会把窗顶出去。改战斗界面的任何尺寸，都要回头量一遍
  390×667 / 430×740 / 430×900 / 1280×720 这几档还装不装得下。
- **页面缩放整个钉死**（用户要求"固定住"）：两个 viewport meta 都带
  `maximum-scale=1, user-scalable=no`，CSS 里 `html{touch-action:manipulation}`，
  index.html 顶部还有一段 JS 兜底（iOS 不认 user-scalable）：`gesturestart/change/end` 全 preventDefault，
  再加「同一位置 300ms 内第二次触摸」。
  ⚠️ 那段 touchend 兜底**必须带位置判断并放过 button/input/label/a/.c** ——
  见到第二次触摸就无脑 preventDefault 会把第二次的 click 一起吃掉，连点两下按钮就有一下不算数。
- **生命上限涨了要补当前血**：所有改 `P.relics` 的地方都包在 `withMaxHp()` 里 ——
  上限 +8 时当前血也 +8（20/30 → 28/38），换掉/拆掉加血遗物时把当前血压回新上限（至少留 1 点）。
  新增任何会动遗物的入口，**必须也从 `withMaxHp()` 过**。

## 存档系统

全在浏览器 localStorage 里，六个键（`util.js` 的 `load` / `save` 负责读写）：

| 键 | 存什么 | 什么时候清 |
| --- | --- | --- |
| `youxu.a1lex.v1` | 每个词的熟练度 `{str, seen, wrong}` | 永久 |
| `youxu.codex.v1` | 遗物图鉴（初见层数、拿过几次） | 永久 |
| `youxu.meta2.v1` | 最深层 / 探索次数 / 通关 / 死亡 / 最后写入时间 `t` | 永久 |
| `youxu.town.v1` | 镇上存款 | 永久 |
| `youxu.opt.v1` | 设置项（发音、自动下一题、锁定冒险 `lock`） | 永久 |
| `youxu.run.v1` | 没走完的那一趟（地图压成字符串，怪只存 defId + 状态） | 死透 / 通关 / 放弃就删 |

**读是自动的，存只有三下**（用户 2026-09 定的，别再加别的存档时机）：
- 读：`boot()` 里 `readRun()` 有档就直接 `resumeRun()`，**不弹窗不询问**。
  以前那个「继续 / 重新开始」弹层（`veilResume`）已经删掉了，别再加回来。
- 存：**只有这三个时刻**，全部走 `game.js` 的 `commit(keepRun)`：
  1. **进入关卡** —— `enterRoute` → `newRun` → `nextFloor` 里那一次 `commit(true)`
  2. **下一层** —— `nextFloor()` 末尾 `commit(true)`
  3. **回到主城** —— `goTown()` 的 `commit(false)`；死亡/通关的结算 `endRun()` 也算这一档（也是 `commit(false)`）
- 所以续玩档存的是「**刚踏进这一层时**的样子」：中途关页面 = 退回本层开头重来，
  这一层里打的怪、捡的金币、拿的遗物都不算数。`resumeRun` 的文案已经这么写了。
- 以前挂在这儿的 `pagehide` / `freeze` / `blur` / `visibilitychange` 四个监听和
  `setInterval(saveRun, 15000)` **全删了**，走路/战斗/拿遗物/买卖里的 `saveRun()` 也全删了。
  别再加回来。

代码上的规矩：
- `LEX`（熟练度）、`CODEX`（图鉴）、`MET`（统计）、`TOWN`（存款）四份**常驻内存**，
  游戏过程中只改内存对象，落盘交给 `commit()`。别在别处直接 `put(某个_KEY, …)`。
- `commitPerm()` 只写这四个永久键；`commit(keepRun)` = `commitPerm()` + 写/删续玩档。
  导入存档走 `commitPerm()`（它不是游戏里的存档点，是存档管理，且不该动层存档）。
- `meta()` 返回的就是内存里的 `MET`，改完等 `commit()`，不要再单独写 localStorage。
- 设置项 `OPT` 是例外，改了立刻 `saveOpt()` 落盘 —— 它不是游戏进度。
- 「清除全部存档」删完 localStorage **必须同时把内存里的 LEX/CODEX/MET/TOWN 清空**，
  否则紧接着的 `goTown()` 会把旧数据原样写回去。
- 首次打开**不再自动弹玩法说明**（用户后面要做新手教程关卡替代它）。
  `veilHelp` 本身留着，设置页的「玩法说明」按钮还能打开。
- 每一次实际写 localStorage 都过 `game.js` 的 `put()`：`util.js` 的 `save()` 现在返回布尔，
  写不进去（无痕模式、存储被禁、配额满）会顶到页面顶部的报错横幅上（`window.showErr`），
  不再静默丢档。**别直接用 `save()`；也别直接用 `put()` —— 走 `commit()`。**

搬家有两条路，都在设置页：

1. **本地存档文件**（`snapshot()` → 一个 `.json`，上面六个键全在里面）。
   选中或拖进来会**立刻读出来**，先把信息摊在卡片上（层数、等级、掌握词数、存款、存档时间），
   再让玩家选「合并导入」还是「整档覆盖」。覆盖会 `location.reload()` —— 页面上到处是旧数字，
   重载最干净，而且开局流程本来就会问要不要接着走那一趟。
2. **导出码**（`YX1.` + base64），只带永久数据，不带那一趟。两条路共用 `mergeData()`。

合并规矩（`mergeData`）：熟练度取高的、图鉴取并集、统计取大值、**存款取大值不相加**（免得来回导两次就富了）、
续玩档只在本地没有在进行的探索时才接过来。

⚠️ **以后新增任何 localStorage 键，必须同时改五个地方**：`commit()` / `commitPerm()`（落盘）、
`snapshot()`（导出）、`overwriteAll()`（覆盖）、`mergeData()`（合并）、设置页「清除全部存档」的键列表。
漏了就会出现「导出了但没带过去」的静默 bug。

## 部署机制

`.github/workflows/deploy.yml`：推到 `main` 就自动部署，也可以手动触发（`workflow_dispatch`）。
流程是 checkout → configure-pages → 把游戏文件拷进 `_site` → upload-pages-artifact → deploy-pages。
通常 30～60 秒上线。

仓库 Settings → Pages 的 Source 已经设成 **GitHub Actions**，这是一次性设置，已完成。

## 踩过的坑（别再踩）

- **不要用 `actions/configure-pages` 的 `enablement: true`。** 第一次部署时它会失败：
  `Create Pages site failed. Error: Resource not accessible by integration`。
  Actions 的 GITHUB_TOKEN 没有创建 Pages 站点的权限，无论 workflow 的 `permissions` 块写什么都不行。
  必须由仓库主人在 Settings 里手动开一次（已经开好了）。
- **Claude 的 GitHub App 不能创建仓库**（`POST /user/repos` 返回 403）。需要新仓库时让用户自己建。
- **workflow 是显式列举要发布哪些文件的**（`cp index.html style.css *.js .nojekyll _site/`）。
  新增任何需要上线的文件，**必须同时加进这个 cp 列表**，否则不会出现在网站上。
  ⚠️ 特别是以后绑定自定义域名时 GitHub 会生成的 `CNAME` 文件 —— 漏了域名就会失效。
- **Claude 的沙盒访问不了 `*.github.io`**（代理返回 `403 to CONNECT`）。
  所以没法用 curl 自测线上网站，只能看 Actions 日志判断部署是否成功，或者请用户帮忙打开确认。
  本地自测可以：`python3 -m http.server` 然后用 Playwright 打开（Chromium 在 `/opt/pw-browsers`）。
- 页面顶部内置了报错横幅（`#errbar`），JS 一出错会直接显示在页面上，不用开 F12。排查问题时先问用户看没看到它。

## 待办

- [ ] **网站图标**：现在没有 favicon，浏览器标签页空白，请求 `/favicon.ico` 会 404。原 Artifact 的图标是 🗡🔥
- [ ] **自定义域名**：用户想绑 `www.xxx.com`，还没买域名。买了之后：Settings → Pages 填域名 →
      DNS 加 CNAME 指向 `audience20060904-lang.github.io` → **把 `CNAME` 加进 workflow 的 cp 列表** → 勾 Enforce HTTPS
- [ ] 第二章还没做（`content.js` 的 `ROUTES` 里目前只有「石廊」一条路，铁匠铺在主城里是灰的）

## 新会话怎么接手

1. 如果这个仓库不在会话的 GitHub scope 里，先用 `add_repo` 加上 `audience20060904-lang/youxu-huilang`，然后 clone。
2. 改完**自动上线**（见上面「已经定下来的事」第 5 条，不用问用户）：提交 → 推到 `main` →
   用 Actions 的 API 确认部署成功（`list_workflow_runs` 看 conclusion）。
   **不要用 curl 去验证网站** —— 沙盒访问不了 github.io，见上面「踩过的坑」。
3. 部署失败的话，用 `get_job_logs` 带 `failed_only: true` 看日志，修好再推一次，别把失败晾着。

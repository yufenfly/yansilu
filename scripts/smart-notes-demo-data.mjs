const SOURCE_ID = "SRC-SMART-NOTES";

const permanentDefinitions = [
  ["PERM-WRITING-STARTS-BEFORE-DRAFT", "写作不是最后一步，而是整理笔记的方向", "写作", "从记录开始就问它以后能回答什么问题，材料才不会只停在收藏夹。", "研思录把记录、关联、主题和写作连成一条路。", "不是每条记录都要写成文章；它只需要有清楚的下一步。", ["写作中心应该从已确认判断生成提纲", "主题索引不是文件夹，而是问题入口"]],
  ["PERM-PARAPHRASE-BEFORE-JUDGMENT", "文献笔记要先转述，再沉淀判断", "文献笔记", "先用自己的话重说材料，才能看见自己是否真的理解。", "文献笔记把摘录、转述和候选永久笔记分开。", "转述可以保留疑问，不必急着得出结论。", ["摘录不等于理解", "永久笔记是一条用户愿意承担的判断"]],
  ["PERM-PERMANENT-NOTE-IS-JUDGMENT", "永久笔记是一条用户愿意承担的判断", "永久笔记", "永久笔记不是摘要，而是一条离开原材料也能继续使用的判断。", "判断可以被支持、反驳、限定，并进入主题和写作。", "判断可以很小，也可以带条件；清楚比宏大重要。", ["边界和反例让永久笔记更可靠", "永久笔记标题应该像一句判断"]],
  ["PERM-RELATION-REASON-MATTERS", "关系理由比连线本身更重要", "关联", "写清两条笔记为什么相关，连接才会留下可复用的思考。", "关联时选择关系类型，并写一句人能读懂的理由。", "说不清理由时先不保存，比制造一条空连接更好。", ["关系类型是在告诉未来自己怎么读这两条笔记", "关联理由是在替未来文章预写一小段"]],
  ["PERM-THEME-INDEX-IS-ENTRY", "主题索引不是文件夹，而是问题入口", "主题", "主题索引围绕一个问题组织关键笔记，让用户下次能继续思考。", "主题索引显示中心问题、关键笔记和进入写作的入口。", "三到七条关键笔记就能先建立主题，不必等资料齐全。", ["主题索引应该从一个中心问题开始", "主题索引是会继续生长的文章前身"]],
  ["PERM-COMPOUND-INTEREST-FROM-REUSE", "知识网络的复利来自旧笔记遇到新问题", "关联", "旧判断在新主题和新文章中被再次使用，才会产生知识复利。", "图谱和主题索引帮助旧笔记重新出现。", "复用要有理由，不能为了数量硬把笔记塞进主题。", ["关系类型会改变以后发现新东西的方式", "主题索引要保存一条可读顺序"]],
  ["PERM-MOBILE-CAPTURE-DESKTOP-ORGANIZE", "手机负责快速记录，电脑负责深入整理", "记录", "手机适合随时捕捉，电脑适合转述、关联、主题和写作。", "手机记录会进入电脑端首页，继续加工。", "手机不是桌面版缩小版，复杂整理仍以电脑为主。", ["随笔是捕捉点，不是知识点", "首页应该像每天整理知识的工作台"]],
  ["PERM-FLEETING-NOTE-IS-CAPTURE", "随笔是捕捉点，不是知识点", "记录", "随笔先留下现场想法，之后还要判断、转成永久笔记或删除。", "首页优先接住未处理随笔。", "允许粗糙，但不能长期把未处理内容当成知识。", ["记录是入口，不是知识本身", "手机负责快速记录，电脑负责深入整理"]],
  ["PERM-TODAY-REVIEW-REWARDS-PROCESSING", "首页应该奖励处理，而不是奖励收藏", "首页", "每天推进一条材料，比继续增加库存更能积累知识。", "首页直接给出当前最值得做的动作。", "一次只做一个小动作也算完成。", ["首页应该像每天整理知识的工作台", "第一次使用研思录应该先走一条小闭环"]],
  ["PERM-AI-SUGGESTION-IS-CANDIDATE", "AI 建议只能作为候选，不能替用户下判断", "AI", "AI 可以提出候选，但永久笔记、关系和文章仍由用户确认。", "提炼、候选关联、提纲和检查都有确认入口。", "不用 AI 也能走完整主流程。", ["AI 只能提出候选，保存前必须由用户确认", "没有 AI 也能走完整主流程"]],
  ["PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES", "写作中心应该从已确认判断生成提纲", "写作", "写作从用户已经确认的主题和关键笔记开始，而不是从空白提示词开始。", "选择主题和相关笔记后生成提纲，再进入草稿。", "AI 可以补充结构，但不能偷偷替换用户观点。", ["好提纲需要证据、反方和边界", "写作时要按关系角色调用笔记"]],
  ["PERM-BACKUP-BEATS-IMPORT-EXPORT", "没有 AI 也能走完整主流程", "AI", "记录、整理、关联、主题和写作都不依赖 AI 才能成立。", "AI 未配置时，界面保留原有手动动作。", "AI 是加速器，不是进入产品的门槛。", ["AI 建议只能作为候选，不能替用户下判断", "AI 应该出现在具体任务旁边"]],
  ["PERM-ROADMAP-GROWS-FROM-NOTES", "AI 应该出现在具体任务旁边", "AI", "用户不该先进入一个复杂 AI 中心，再寻找自己要做的事。", "在材料旁提炼、在关联旁推荐、在写作旁生成提纲或检查。", "AI 状态不能抢占主流程注意力。", ["材料提炼只生成可编辑草稿", "AI 候选关联必须说明推荐理由"]],
  ["PERM-BOUNDARY-MAKES-NOTE-RELIABLE", "边界和反例让永久笔记更可靠", "永久笔记", "说明判断在什么条件下不成立，会让笔记更可信。", "永久笔记保留边界，写作检查也会提醒过度结论。", "写边界不是削弱观点，而是说明它能走多远。", ["永久笔记是一条用户愿意承担的判断", "限定关系能防止一条好判断被说过头"]],
  ["PERM-QUOTE-IS-NOT-UNDERSTANDING", "摘录不等于理解", "文献笔记", "保存原文只能保留材料，不能证明自己已经理解。", "把摘录转述成自己的话，再决定是否生成永久笔记。", "重要原文仍应保留，作为来源而不是自己的观点。", ["文献笔记要先转述，再沉淀判断", "用自己的话重说，是第一次思考"]],
  ["PERM-LINK-TYPES-CREATE-DISCOVERY", "关系类型会改变以后发现新东西的方式", "关联", "支持、反驳、限定、桥接等关系，会让同一组笔记产生不同读法。", "关联列表和图谱按关系类型展示笔记。", "新手先掌握少数高价值类型，不需要一次学完。", ["关系类型是在告诉未来自己怎么读这两条笔记", "反驳关系会逼出更清楚的观点"]],
  ["PERM-FIRST-TEN-MINUTES", "第一次使用研思录应该先走一条小闭环", "上手", "新手先处理一条材料、建一条关系、看一个主题，再进入写作。", "Demo 把完整路径准备好，用户只需跟着做一次。", "第一次体验不要求理解全部功能。", ["第一次建议导入 Demo，是为了先看到完整闭环", "研思录的最佳路径，是从首页开始做一个小闭环"]],
  ["PERM-DEMO-FIRST-RUN-RECOMMENDED", "第一次建议导入 Demo，是为了先看到完整闭环", "上手", "真实样例比一页功能说明更容易让新手理解产品。", "Demo 由用户确认后一键导入，并可单独体验。", "Demo 不应自动混进用户自己的笔记。", ["Demo 应该是可练习的样例库，不是静态说明书", "帮助页应该按任务组织，而不是按功能堆列表"]],
  ["PERM-HELP-SHOULD-FOLLOW-TASKS", "帮助页应该按任务组织，而不是按功能堆列表", "帮助", "用户遇到问题时想知道下一步怎么做，而不是阅读功能目录。", "帮助按导入 Demo、处理材料、关联、主题、写作和 AI 设置组织。", "方法解释保持简短，详细背景放在可选文章里。", ["Demo 应该是可练习的样例库，不是静态说明书", "研思录的最佳路径，是从首页开始做一个小闭环"]],
  ["PERM-BEST-PATH-STARTS-FROM-HOME", "研思录的最佳路径，是从首页开始做一个小闭环", "首页", "首页应把最值得推进的动作放在首屏，其他功能按需进入。", "处理材料、补关系、整理主题或进入写作都从首页承接。", "用户也可以从笔记盒直接编辑，不必被固定流程限制。", ["首页应该像每天整理知识的工作台", "第一次使用研思录应该先走一条小闭环"]],
  ["PERM-UNLINKED-PRACTICE", "关系理由练习：给已有笔记补一条说明", "关联", "正文链接和人工关系都能让笔记进入知识网络；真正值得补的是一条可读的关系理由。", "先看这条笔记已有的正文链接和人工关系；再在 Demo 中搜索一条新笔记，选择关系类型并写清为什么相关。", "找不到清楚理由时可以关闭，不必勉强关联。", ["关系理由比连线本身更重要", "关系类型是在告诉未来自己怎么读这两条笔记"]],
  ["PERM-PRACTICE-UNLINKED-QUESTION", "练习：这个判断还需要找一条支撑笔记", "关联练习", "有些判断先单独放着，等找到真正相关的笔记后再关联。", "Demo 故意保留少量未关联笔记，让用户练习从搜索、选择到保存关系的过程。", "找不到清楚理由时，不要为了消除提醒而勉强连接。", []],
  ["PERM-PRACTICE-UNLINKED-BOUNDARY", "练习：这条边界暂时还没有放进网络", "关联练习", "边界判断也需要找到对应观点，才能在写作时提醒用户不要说过头。", "这条笔记用于练习补关系，用户可以给它找一个被限定或被反驳的目标。", "没有合适对象时，保持独立比保存一条空关系更好。", []],
  ["PERM-CAPTURE-IS-INBOX-NOT-KNOWLEDGE", "记录是入口，不是知识本身", "记录", "捕捉只是把想法放进收件箱，整理才让它进入知识网络。", "首页显示待处理材料并给出下一步。", "有些记录会被删除，删除也是整理。", ["随笔是捕捉点，不是知识点", "首页应该奖励处理，而不是奖励收藏"]],
  ["PERM-LITERATURE-NOTE-KEEPS-SOURCE-BOUNDARY", "文献笔记要保留来源边界", "文献笔记", "把作者原意和自己的理解分开，才能避免误把摘录当观点。", "文献笔记保留来源、转述和处理状态。", "这里不要求复杂学术引用，只要能回到来源。", ["摘录不等于理解", "用自己的话重说，是第一次思考"]],
  ["PERM-OWN-WORDS-ARE-FIRST-THINKING", "用自己的话重说，是第一次思考", "文献笔记", "重说材料会暴露没看懂的地方，也会产生自己的问题。", "用户可以手动转述，也可让 AI 先给可编辑草稿。", "AI 草稿必须由用户改写或确认。", ["文献笔记要先转述，再沉淀判断", "材料提炼只生成可编辑草稿"]],
  ["PERM-ATOMIC-NOTE-ANSWERS-ONE-QUESTION", "一条永久笔记最好只回答一个问题", "永久笔记", "一个问题对应一个判断，笔记才容易复用和关联。", "复杂内容拆成多条笔记，再通过关系和主题组织。", "原子化不是把句子切碎，而是让判断保持完整。", ["永久笔记标题应该像一句判断", "主题索引是会继续生长的文章前身"]],
  ["PERM-TITLE-SHOULD-BE-A-CLAIM", "永久笔记标题应该像一句判断", "永久笔记", "判断型标题能在列表和图谱中直接告诉用户这条笔记在说什么。", "编辑标题时用人话，不暴露内部编码。", "探索中的笔记可以先用临时标题，确认后再改。", ["永久笔记是一条用户愿意承担的判断", "一条永久笔记最好只回答一个问题"]],
  ["PERM-RELATION-TYPE-IS-A-READING-INSTRUCTION", "关系类型是在告诉未来自己怎么读这两条笔记", "关联", "关系类型为未来阅读和写作留下方向。", "支持可作证据，反驳可作反方，限定可写边界，桥接可发现主题。", "无法判断类型时可先选相关，再补充理由。", ["支持关系以后会变成文章里的证据", "桥接关系常常预示一个新主题正在出现"]],
  ["PERM-SUPPORT-RELATION-BECOMES-EVIDENCE", "支持关系以后会变成文章里的证据", "关联", "支持关系回答一个判断为什么站得住。", "写作中心可把支持关系带入论据位置。", "支持不是重复；同义笔记应考虑合并。", ["写作时要按关系角色调用笔记", "好提纲需要证据、反方和边界"]],
  ["PERM-CONTRAST-RELATION-CREATES-ARGUMENT", "反驳关系会逼出更清楚的观点", "关联", "面对反方，用户必须说明自己的判断在哪些条件下成立。", "图谱可帮助发现相互冲突的笔记。", "反驳不是为了争胜，而是为了修正观点。", ["边界和反例让永久笔记更可靠", "好提纲需要证据、反方和边界"]],
  ["PERM-LIMIT-RELATION-PROTECTS-OVERCLAIM", "限定关系能防止一条好判断被说过头", "关联", "限定关系补充适用条件，让观点保持可信。", "写作检查可提醒缺少边界的结论。", "限定不是否定原判断。", ["边界和反例让永久笔记更可靠", "反驳关系会逼出更清楚的观点"]],
  ["PERM-BRIDGE-RELATION-FINDS-NEW-THEME", "桥接关系常常预示一个新主题正在出现", "关联", "一条笔记能连接两个原本分开的笔记群时，常会带来新问题。", "图谱用桥接关系帮助用户发现跨主题线索。", "偶然共词不等于桥接，仍要写清理由。", ["关系类型会改变以后发现新东西的方式", "主题索引应该从一个中心问题开始"]],
  ["PERM-EXAMPLE-RELATION-MAKES-ABSTRACT-USABLE", "例子关系让抽象原则变得可操作", "关联", "例子把抽象判断放进具体场景，读者才知道如何行动。", "Demo 用材料、永久笔记和写作项目展示同一原则。", "个别例子不能证明原则永远成立。", ["支持关系以后会变成文章里的证据", "好提纲需要证据、反方和边界"]],
  ["PERM-GAP-RELATION-POINTS-TO-NEXT-READING", "缺口会告诉你下一步该补什么", "关联", "当观点缺少证据、反方或边界时，缺口就是下一次阅读和记录的方向。", "图谱和写作检查只提示候选缺口，由用户决定是否处理。", "不是每个缺口都要立即填满。", ["好提纲需要证据、反方和边界", "AI 候选关联必须说明推荐理由"]],
  ["PERM-RELATION-REASON-WRITES-FUTURE-PARAGRAPH", "关联理由是在替未来文章预写一小段", "关联", "一句清楚的关联理由，常常就是未来段落的论证骨架。", "写作中心保留关系理由，帮助组织提纲。", "理由应说明两条笔记的关系，而不是重复标题。", ["关系理由比连线本身更重要", "写作时要按关系角色调用笔记"]],
  ["PERM-INDEX-CARD-STARTS-WITH-CENTRAL-QUESTION", "主题索引应该从一个中心问题开始", "主题", "中心问题决定哪些笔记值得进入主题，以及按什么顺序阅读。", "创建主题时先写问题，再选择关键笔记。", "问题可以随着新笔记继续修改。", ["主题索引不是文件夹，而是问题入口", "主题索引要保存一条可读顺序"]],
  ["PERM-INDEX-CARD-KEEPS-READING-ORDER", "主题索引要保存一条可读顺序", "主题", "顺序让一组笔记从清单变成可以理解的思考路径。", "主题索引允许调整关键笔记顺序。", "顺序不是永久固定，观点变化后可以重排。", ["主题索引应该从一个中心问题开始", "主题索引是会继续生长的文章前身"]],
  ["PERM-INDEX-CARD-IS-LIVING-OUTLINE", "主题索引是会继续生长的文章前身", "主题", "主题索引加入关键笔记和顺序后，已经具备文章提纲的雏形。", "可从主题直接进入写作中心。", "主题索引仍服务思考，不必都变成文章。", ["主题索引要保存一条可读顺序", "写作中心应该从已确认判断生成提纲"]],
  ["PERM-TAGS-ARE-FAST-FILTERS-INDEXES-ARE-QUESTIONS", "标签用来快速筛选，主题索引用来继续思考", "主题", "标签回答有哪些，主题索引回答围绕什么问题继续想。", "用标签搜索，用主题组织关键笔记和写作入口。", "不要为每个标签都建立主题。", ["主题索引不是文件夹，而是问题入口", "主题索引应该从一个中心问题开始"]],
  ["PERM-WRITING-USES-RELATION-ROLES", "写作时要按关系角色调用笔记", "写作", "文章需要主张、证据、反方、边界、例子和过渡，关系类型正好提供这些角色。", "写作中心从相关笔记和关系生成可检查提纲。", "关系类型只能帮助组织，不能自动保证文章质量。", ["支持关系以后会变成文章里的证据", "好提纲需要证据、反方和边界"]],
  ["PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY", "好提纲需要证据、反方和边界", "写作", "只有观点的提纲容易变成口号，加入证据、反方和边界才完整。", "生成提纲后先检查缺口，再决定是否开始草稿。", "短文章可以简化结构，但不能省掉必要判断。", ["写作时要按关系角色调用笔记", "草稿应该能追溯到关键笔记"]],
  ["PERM-DRAFT-SHOULD-KEEP-NOTE-TRACE", "草稿应该能追溯到关键笔记", "写作", "知道一段话来自哪条笔记，才能回头检查证据和边界。", "写作中心保留关键笔记和提纲来源。", "追溯服务修改，不要求正文充满内部编号。", ["写作中心应该从已确认判断生成提纲", "好提纲需要证据、反方和边界"]],
  ["PERM-HELP-ARTICLES-CAN-BE-DEMO-OUTPUT", "帮助文章也可以从 Demo 笔记长出来", "帮助", "用真实笔记生成帮助文章，本身就在展示产品方法。", "Demo 写作项目包含上手和关系类型两篇帮助文章。", "帮助要简洁，不把所有解释塞进主界面。", ["帮助页应该按任务组织，而不是按功能堆列表", "Demo 应该是可练习的样例库，不是静态说明书"]],
  ["PERM-HOME-AS-DAILY-DESK", "首页应该像每天整理知识的工作台", "首页", "首页只突出当前最值得推进的动作，让用户每天都知道从哪里开始。", "首屏承接材料、关联、主题和写作。", "统计和辅助检查按需展开，不抢占主动作。", ["首页应该奖励处理，而不是奖励收藏", "研思录的最佳路径，是从首页开始做一个小闭环"]],
  ["PERM-DEMO-IS-PRACTICE-GROUND", "Demo 应该是可练习的样例库，不是静态说明书", "上手", "用户通过处理、关联、主题和写作来学会产品，比阅读长说明更有效。", "Demo 保留待处理材料和待关联笔记供用户操作。", "Demo 数据与用户真实笔记分开，由用户确认导入。", ["第一次建议导入 Demo，是为了先看到完整闭环", "帮助文章也可以从 Demo 笔记长出来"]],
  ["PERM-AI-SHOULD-ASK-FOR-CONFIRMATION", "AI 只能提出候选，保存前必须由用户确认", "AI", "凡是会改变笔记、关系或草稿的 AI 结果，都要先让用户看见和确认。", "候选结果可编辑、忽略或保存。", "自动启动本地模型不等于自动改动用户内容。", ["AI 建议只能作为候选，不能替用户下判断", "AI 候选关联必须说明推荐理由"]],
  ["PERM-AI-DISTILL-DRAFT", "材料提炼只生成可编辑草稿", "AI", "AI 可以先把材料压成候选判断，但用户要负责改写和确认。", "在材料旁使用“帮我提炼”或选中文字后“提炼这段”。", "提炼失败时仍可手动写永久笔记。", ["用自己的话重说，是第一次思考", "AI 只能提出候选，保存前必须由用户确认"]],
  ["PERM-AI-RELATION-EXPLAINS-WHY", "AI 候选关联必须说明推荐理由", "AI", "只给相似度没有用，候选关联必须说明两条笔记为什么可能相关。", "用户检查对象、关系类型和理由后再保存。", "本地规则优先，AI 只补充少量候选。", ["关系理由比连线本身更重要", "AI 只能提出候选，保存前必须由用户确认"]],
  ["PERM-AI-WRITING-CHECK-DOES-NOT-REWRITE", "AI 检查应该指出缺口，而不是重写整篇文章", "AI", "写作检查最有价值的是指出证据、反方、边界和结构缺口。", "用户可以采纳单条建议，不必接受整篇改写。", "检查结果不是事实判断，仍需核对来源。", ["好提纲需要证据、反方和边界", "AI 只能提出候选，保存前必须由用户确认"]]
];

// The default Demo is a practice set, not a second knowledge base. These notes
// form one complete, visible chain from capture to a traceable writing outline.
const CORE_PERMANENT_IDS = new Set([
  "PERM-WRITING-STARTS-BEFORE-DRAFT",
  "PERM-PARAPHRASE-BEFORE-JUDGMENT",
  "PERM-PERMANENT-NOTE-IS-JUDGMENT",
  "PERM-RELATION-REASON-MATTERS",
  "PERM-SUPPORT-RELATION-BECOMES-EVIDENCE",
  "PERM-CONTRAST-RELATION-CREATES-ARGUMENT",
  "PERM-BOUNDARY-MAKES-NOTE-RELIABLE",
  "PERM-COMPOUND-INTEREST-FROM-REUSE",
  "PERM-THEME-INDEX-IS-ENTRY",
  "PERM-INDEX-CARD-IS-LIVING-OUTLINE",
  "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES",
  "PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY",
  "PERM-UNLINKED-PRACTICE",
  "PERM-FLEETING-NOTE-IS-CAPTURE"
]);
const CORE_PERMANENT_TITLES = new Set(
  permanentDefinitions.filter(([id]) => CORE_PERMANENT_IDS.has(id)).map(([, title]) => title)
);
const CORE_LITERATURE_IDS = new Set([
  "LN-WRITING-AS-DAILY-PRACTICE",
  "LN-PARAPHRASE-IS-FIRST-CHECK",
  "LN-PERMANENT-NOTE-AS-OWNED-CLAIM",
  "LN-LINKING-NEEDS-REASON"
]);
const CORE_FLEETING_IDS = new Set([
  "FN-PHONE-CAPTURE-UNPROCESSED",
  "FN-WRITING-CENTER-PROCESSED",
  "FN-RELATION-REASON-UNLINKED"
]);
const CORE_INDEX_IDS = new Set([
  "THEME-WHAT-IS-PERMANENT-NOTE",
  "THEME-WHY-LINK-NOTES",
  "THEME-INDEX-TO-WRITING"
]);
const MATERIAL_TO_JUDGMENT_IDS = new Set([
  "PERM-FLEETING-NOTE-IS-CAPTURE",
  "PERM-PARAPHRASE-BEFORE-JUDGMENT",
  "PERM-PERMANENT-NOTE-IS-JUDGMENT",
  "PERM-BOUNDARY-MAKES-NOTE-RELIABLE"
]);
const RELATION_AND_REUSE_IDS = new Set([
  "PERM-RELATION-REASON-MATTERS",
  "PERM-SUPPORT-RELATION-BECOMES-EVIDENCE",
  "PERM-CONTRAST-RELATION-CREATES-ARGUMENT",
  "PERM-COMPOUND-INTEREST-FROM-REUSE",
  "PERM-UNLINKED-PRACTICE"
]);

function demoClusterFor(id) {
  if (MATERIAL_TO_JUDGMENT_IDS.has(id)) return "材料到判断";
  if (RELATION_AND_REUSE_IDS.has(id)) return "关系与复利";
  return "主题到写作";
}

const literatureDefinitions = [
  ["LN-WRITING-AS-DAILY-PRACTICE", "阅读一开始就要面向未来写作", "写作不是最后打开文档才开始，阅读时就要问材料未来能回答什么问题。", ["PERM-WRITING-STARTS-BEFORE-DRAFT", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES"], "converted"],
  ["LN-CAPTURE-NEEDS-FOLLOWUP", "临时记录必须承诺下一步", "随笔只负责捕捉，之后要转述、形成判断、建立关系或删除。", ["PERM-FLEETING-NOTE-IS-CAPTURE", "PERM-TODAY-REVIEW-REWARDS-PROCESSING"], "converted"],
  ["LN-PARAPHRASE-IS-FIRST-CHECK", "用自己的话重说，才能检查理解", "文献笔记的第一步不是摘录更多，而是把材料说成自己的话。", ["PERM-PARAPHRASE-BEFORE-JUDGMENT", "PERM-OWN-WORDS-ARE-FIRST-THINKING"], "converted"],
  ["LN-PERMANENT-NOTE-AS-OWNED-CLAIM", "永久笔记要能脱离原文使用", "永久笔记应表达用户愿意继续使用、修改或反驳的判断。", ["PERM-PERMANENT-NOTE-IS-JUDGMENT", "PERM-ATOMIC-NOTE-ANSWERS-ONE-QUESTION"], "converted"],
  ["LN-LINKING-NEEDS-REASON", "新笔记要进入旧网络", "连接不是为了让图谱变密，而是为未来阅读留下理由。", ["PERM-RELATION-REASON-MATTERS", "PERM-RELATION-TYPE-IS-A-READING-INSTRUCTION"], "needs_processing"],
  ["LN-INDEX-AS-QUESTION-ENTRY", "主题索引围绕问题组织笔记", "索引应让用户重新进入问题，而不是完成一次分类。", ["PERM-THEME-INDEX-IS-ENTRY", "PERM-INDEX-CARD-STARTS-WITH-CENTRAL-QUESTION"], "converted"],
  ["LN-REUSE-CREATES-COMPOUND-INTEREST", "旧笔记在新问题中产生复利", "知识复利来自旧判断被新主题和新文章重新调用。", ["PERM-COMPOUND-INTEREST-FROM-REUSE"], "converted"],
  ["LN-AI-KEEPS-CANDIDATE-STATE", "AI 参与时要保留候选状态", "AI 可以帮助提炼、关联和写作，但结果必须可检查、可改写、可忽略。", ["PERM-AI-SUGGESTION-IS-CANDIDATE", "PERM-AI-SHOULD-ASK-FOR-CONFIRMATION"], "converted"],
  ["LN-PRODUCT-ROADMAP-FROM-NOTES", "AI 应该在具体任务旁提供帮助", "AI 的入口应贴近材料提炼、候选关联、提纲和检查，而不是制造一条新流程。", ["PERM-ROADMAP-GROWS-FROM-NOTES", "PERM-AI-DISTILL-DRAFT"], "needs_processing"]
];

const fleetingDefinitions = [
  ["FN-PHONE-CAPTURE-UNPROCESSED", "手机上先记一句：我总是收藏很多但不会用", "地铁上想到：也许产品不该夸我收藏了很多，而该提醒我下一步处理哪一条。", "needs_processing", []],
  ["FN-WRITING-CENTER-PROCESSED", "写作中心不该从空白提示词开始", "写作应该先选择主题和相关笔记，再生成提纲。", "processed", ["PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES"]],
  ["FN-RELATION-REASON-UNLINKED", "建联时最难的是写为什么相关", "关系类型和一句理由，应该比复杂步骤更早出现。", "needs_processing", []],
  ["FN-BACKUP-PRODUCT-IDEA", "选中一段材料时，AI 可以先给一个提炼草稿", "AI 最适合减少起步成本，但不能替用户确认永久笔记。", "processed", ["PERM-AI-DISTILL-DRAFT"]]
];

const indexDefinitions = [
  ["THEME-WHAT-IS-PERMANENT-NOTE", "永久笔记是什么？", "什么时候一条记录才算变成永久笔记？", ["PERM-PERMANENT-NOTE-IS-JUDGMENT", "PERM-ATOMIC-NOTE-ANSWERS-ONE-QUESTION", "PERM-BOUNDARY-MAKES-NOTE-RELIABLE"]],
  ["THEME-WHY-LINK-NOTES", "为什么要关联笔记？", "关联怎样让旧笔记继续产生新理解？", ["PERM-RELATION-REASON-MATTERS", "PERM-COMPOUND-INTEREST-FROM-REUSE", "PERM-RELATION-REASON-WRITES-FUTURE-PARAGRAPH"]],
  ["THEME-COMPOUND-INTEREST", "知识网络为什么会形成复利？", "旧笔记在什么条件下会产生复利？", ["PERM-COMPOUND-INTEREST-FROM-REUSE", "PERM-THEME-INDEX-IS-ENTRY", "PERM-WRITING-USES-RELATION-ROLES"]],
  ["THEME-RELATION-TYPES", "关联笔记有哪些关系？如何设置关系？", "关系类型和理由应该怎样选择？", ["PERM-RELATION-TYPE-IS-A-READING-INSTRUCTION", "PERM-SUPPORT-RELATION-BECOMES-EVIDENCE", "PERM-CONTRAST-RELATION-CREATES-ARGUMENT", "PERM-LIMIT-RELATION-PROTECTS-OVERCLAIM", "PERM-BRIDGE-RELATION-FINDS-NEW-THEME"]],
  ["THEME-MOBILE-DESKTOP", "手机笔记功能和电脑笔记功能有什么区别？如何形成互动？", "如何让手机捕捉和电脑整理成为同一条路？", ["PERM-MOBILE-CAPTURE-DESKTOP-ORGANIZE", "PERM-FLEETING-NOTE-IS-CAPTURE", "PERM-HOME-AS-DAILY-DESK"]],
  ["THEME-DEMO-FIRST-RUN", "为什么第一次建议导入 Smart Notes Demo？", "Demo 怎样帮助新手更快理解研思录？", ["PERM-DEMO-FIRST-RUN-RECOMMENDED", "PERM-DEMO-IS-PRACTICE-GROUND", "PERM-FIRST-TEN-MINUTES"]],
  ["THEME-FIRST-USE", "第一次使用研思录应该先做什么？", "怎样用十分钟走完一个小闭环？", ["PERM-FIRST-TEN-MINUTES", "PERM-BEST-PATH-STARTS-FROM-HOME", "PERM-TODAY-REVIEW-REWARDS-PROCESSING"]],
  ["THEME-HELP-BEST-PATH", "研思录帮助应该怎样服务新手？", "帮助怎样让用户快速找到下一步？", ["PERM-HELP-SHOULD-FOLLOW-TASKS", "PERM-HELP-ARTICLES-CAN-BE-DEMO-OUTPUT", "PERM-DEMO-IS-PRACTICE-GROUND"]],
  ["THEME-FLEETING-TO-PERMANENT", "如何把一条随笔加工成永久笔记？", "从现场记录到可复用判断要经过什么？", ["PERM-FLEETING-NOTE-IS-CAPTURE", "PERM-CAPTURE-IS-INBOX-NOT-KNOWLEDGE", "PERM-PERMANENT-NOTE-IS-JUDGMENT"]],
  ["THEME-INDEX-TO-WRITING", "如何从主题索引进入写作中心？", "一组关键笔记什么时候可以进入写作？", ["PERM-INDEX-CARD-IS-LIVING-OUTLINE", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES", "PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY"]],
  ["THEME-AI-CANDIDATE", "AI 建议为什么只能作为候选？", "怎样让 AI 有帮助但不替用户做决定？", ["PERM-AI-SUGGESTION-IS-CANDIDATE", "PERM-AI-SHOULD-ASK-FOR-CONFIRMATION", "PERM-BACKUP-BEATS-IMPORT-EXPORT"]],
  ["THEME-PRODUCT-ROADMAP", "AI 在哪些步骤最有帮助？", "AI 应该在哪里出现，才不会破坏主流程？", ["PERM-ROADMAP-GROWS-FROM-NOTES", "PERM-AI-DISTILL-DRAFT", "PERM-AI-RELATION-EXPLAINS-WHY", "PERM-AI-WRITING-CHECK-DOES-NOT-REWRITE"]],
  ["THEME-RELATION-TYPES-TO-WRITING", "关系类型如何帮助后续洞察和写作？", "关系怎样转成文章中的不同角色？", ["PERM-WRITING-USES-RELATION-ROLES", "PERM-SUPPORT-RELATION-BECOMES-EVIDENCE", "PERM-CONTRAST-RELATION-CREATES-ARGUMENT", "PERM-RELATION-REASON-WRITES-FUTURE-PARAGRAPH"]],
  ["THEME-INDEX-NOTE-PRACTICE", "主题索引笔记应该怎么创建和维护？", "怎样把相关笔记组织成可继续思考的入口？", ["PERM-INDEX-CARD-STARTS-WITH-CENTRAL-QUESTION", "PERM-INDEX-CARD-KEEPS-READING-ORDER", "PERM-TAGS-ARE-FAST-FILTERS-INDEXES-ARE-QUESTIONS"]],
  ["THEME-WRITING-FROM-RELATIONS", "如何从关系网络进入写作？", "怎样从观点网络组织文章结构？", ["PERM-WRITING-USES-RELATION-ROLES", "PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY", "PERM-DRAFT-SHOULD-KEEP-NOTE-TRACE"]],
  ["THEME-YANSILU-DAILY-PATH", "研思录每天最推荐的使用路径是什么？", "每天只推进一步时，应该先做什么？", ["PERM-HOME-AS-DAILY-DESK", "PERM-TODAY-REVIEW-REWARDS-PROCESSING", "PERM-BEST-PATH-STARTS-FROM-HOME"]],
  ["THEME-AI-HUMAN-CONFIRMATION", "为什么 AI 建议必须由用户确认？", "怎样保留用户对笔记和文章的判断权？", ["PERM-AI-SHOULD-ASK-FOR-CONFIRMATION", "PERM-AI-RELATION-EXPLAINS-WHY", "PERM-AI-WRITING-CHECK-DOES-NOT-REWRITE"]],
  ["THEME-DEMO-AS-HELP", "Smart Notes Demo 如何帮助新手学会研思录？", "怎样通过一组可操作数据理解核心流程？", ["PERM-DEMO-IS-PRACTICE-GROUND", "PERM-HELP-ARTICLES-CAN-BE-DEMO-OUTPUT", "PERM-DEMO-FIRST-RUN-RECOMMENDED"]]
];

function permanentNote([id, title, cluster, thesis, product, boundary, links]) {
  const related = links.filter((item) => CORE_PERMANENT_TITLES.has(item)).map((item) => `- [[${item}]]`).join("\n");
  const demoCluster = demoClusterFor(id);
  return {
    id,
    note_type: "permanent",
    title,
    cluster: demoCluster,
    cluster_label: demoCluster,
    status: "active",
    distillation_status: "confirmed",
    thesis,
    threeLineSummary: [thesis, product, boundary],
    productImplication: product,
    boundaryOrCounterpoint: boundary,
    from_literature_note_ids: [],
    tags: ["永久笔记", demoCluster, "Smart Notes Demo"],
    body: `# ${title}\n\n## 核心判断\n${thesis}\n\n## 为什么\n${product}\n\n## 边界\n${boundary}\n\n## 继续看\n${related}`,
    core_claim: thesis,
    rationale: product,
    template: { type: "permanent_note", required_sections: ["核心判断", "为什么", "边界", "继续看"] },
    is_key_note: ["PERM-PERMANENT-NOTE-IS-JUDGMENT", "PERM-RELATION-REASON-MATTERS", "PERM-THEME-INDEX-IS-ENTRY", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES"].includes(id),
    authorship: { user_confirmed: true, ai_assisted: false },
    originality_status: "pass"
  };
}

function literatureNote([id, title, paraphrase, candidates, status]) {
  const permanentById = new Map(permanentDefinitions.map((item) => [item[0], item[1]]));
  const availableCandidates = candidates.filter((candidate) => CORE_PERMANENT_IDS.has(candidate));
  return {
    id,
    note_type: "literature",
    source_id: SOURCE_ID,
    title,
    status,
    tags: ["文献笔记", "Smart Notes Demo"],
    paraphrase_text: paraphrase,
    my_takeaway: `这段材料提醒我：${paraphrase}`,
    candidate_permanent_notes: availableCandidates,
    quote_text: "只保留方法主题和原创转述，不复刻原文。",
    questions: ["这条材料能支撑哪一个我愿意承担的判断？"],
    body: `# ${title}\n\n## 来源\n[[《卡片笔记写作法》方法边界]]\n\n## 我的转述\n${paraphrase}\n\n## 可转换为永久笔记\n${availableCandidates.map((candidate) => `- [[${permanentById.get(candidate)}]]`).join("\n")}\n\n## 状态\n${status === "converted" ? "已转换，可继续检查关联。" : "待处理：先确认理解，再决定是否转换。"}`,
    conversion_decision: { status, conversion_reason: status === "converted" ? "已经形成永久笔记。" : "等待用户确认。", key_note_id: availableCandidates[0] || "" }
  };
}

function fleetingNote([id, title, idea, status, processedInto]) {
  return {
    id,
    note_type: "fleeting",
    title,
    status,
    tags: ["随笔", "Smart Notes Demo"],
    raw_idea: idea,
    next_action: status === "processed" ? "已转成永久笔记，可继续检查关联。" : "待处理：改写成自己的判断，或删除。",
    processed_into: processedInto,
    body: `# ${title}\n\n## 先记下来\n${idea}\n\n## 下一步\n${status === "processed" ? "这条随笔已经转成永久笔记。" : "把它改写成自己的判断，或确认它不值得保留。"}`,
    template: { type: "fleeting_note" }
  };
}

function indexCard([id, title, question, noteIds]) {
  const titleById = new Map(permanentDefinitions.map((item) => [item[0], item[1]]));
  const availableNoteIds = noteIds.filter((noteId) => CORE_PERMANENT_IDS.has(noteId));
  const links = availableNoteIds.map((noteId, index) => `${index + 1}. [[${titleById.get(noteId)}]]`).join("\n");
  return {
    id,
    index_type: "topic",
    title,
    central_question: question,
    thesis: question,
    threeLineSummary: ["先看中心问题。", "再读关键笔记。", "能形成结构时进入写作中心。"],
    summary: `围绕“${question}”组织关键笔记。`,
    item_note_ids: availableNoteIds,
    noteIds: availableNoteIds,
    tags: ["主题索引", "Smart Notes Demo"],
    ordering_strategy: "manual",
    key_note_ids: availableNoteIds.slice(0, 1),
    items: availableNoteIds.map((noteId, index) => ({ note_id: noteId, order: index + 1, rationale: `第 ${index + 1} 步读 [[${titleById.get(noteId)}]]。` })),
    template: { type: "index_card" },
    body: `# ${title}\n\n## 中心问题\n${question}\n\n## 关键笔记\n${links}\n\n## 下一步\n如果这组笔记已经能回答中心问题，就从主题进入写作中心。`
  };
}

const relationSeeds = [
  ["PARAPHRASE", "PERM-PARAPHRASE-BEFORE-JUDGMENT", "PERM-WRITING-STARTS-BEFORE-DRAFT", "supports", "转述把材料变成自己的判断，因此支撑面向写作的整理方式。"],
  ["JUDGMENT", "PERM-PERMANENT-NOTE-IS-JUDGMENT", "PERM-RELATION-REASON-MATTERS", "precedes", "先形成清楚判断，之后才有值得说明的笔记关系。"],
  ["BOUNDARY", "PERM-BOUNDARY-MAKES-NOTE-RELIABLE", "PERM-PERMANENT-NOTE-IS-JUDGMENT", "qualifies", "边界限定判断的适用范围，让永久笔记更可靠。"],
  ["INDEX", "PERM-THEME-INDEX-IS-ENTRY", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES", "precedes", "主题索引先组织关键笔记，再进入写作中心生成提纲。"],
  ["REUSE", "PERM-COMPOUND-INTEREST-FROM-REUSE", "PERM-THEME-INDEX-IS-ENTRY", "supports", "主题索引让旧笔记进入新问题，支撑知识复利。"],
  ["MOBILE", "PERM-MOBILE-CAPTURE-DESKTOP-ORGANIZE", "PERM-FLEETING-NOTE-IS-CAPTURE", "example_of", "手机快速记录是随笔作为捕捉入口的具体例子。"],
  ["HOME", "PERM-HOME-AS-DAILY-DESK", "PERM-BEST-PATH-STARTS-FROM-HOME", "supports", "首页工作台支撑从一个小闭环开始的最佳路径。"],
  ["DEMO", "PERM-DEMO-FIRST-RUN-RECOMMENDED", "PERM-FIRST-TEN-MINUTES", "supports", "Demo 提供现成数据，让新手能在十分钟内走完整路径。"],
  ["HELP", "PERM-HELP-SHOULD-FOLLOW-TASKS", "PERM-DEMO-IS-PRACTICE-GROUND", "complements", "按任务组织的帮助和可练习 Demo 共同降低上手成本。"],
  ["AI-CANDIDATE", "PERM-AI-SHOULD-ASK-FOR-CONFIRMATION", "PERM-AI-SUGGESTION-IS-CANDIDATE", "supports", "确认机制确保 AI 始终停留在候选位置。"],
  ["AI-NO-LOCK", "PERM-BACKUP-BEATS-IMPORT-EXPORT", "PERM-AI-SUGGESTION-IS-CANDIDATE", "qualifies", "没有 AI 也能走主流程，限定了 AI 在产品中的角色。"],
  ["AI-CONTEXT", "PERM-ROADMAP-GROWS-FROM-NOTES", "PERM-AI-DISTILL-DRAFT", "example_of", "材料旁的提炼草稿，是 AI 贴近具体任务的例子。"],
  ["AI-RELATION", "PERM-AI-RELATION-EXPLAINS-WHY", "PERM-RELATION-REASON-MATTERS", "supports", "候选关联说明理由，才能真正帮助用户判断关系。"],
  ["AI-WRITING", "PERM-AI-WRITING-CHECK-DOES-NOT-REWRITE", "PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY", "supports", "AI 检查指出证据和边界缺口，支撑完整提纲。"],
  ["CONTRADICTION", "PERM-CONTRAST-RELATION-CREATES-ARGUMENT", "PERM-AI-SUGGESTION-IS-CANDIDATE", "contradicts", "AI 自动替用户定论会削弱反方审视，因此必须保留人工判断。"],
  ["COUNTERPOINT", "PERM-CONTRAST-RELATION-CREATES-ARGUMENT", "PERM-PERMANENT-NOTE-IS-JUDGMENT", "contradicts", "反方笔记会迫使原判断说明自己在哪些条件下成立。"],
  ["BRIDGE", "PERM-BRIDGE-RELATION-FINDS-NEW-THEME", "PERM-INDEX-CARD-STARTS-WITH-CENTRAL-QUESTION", "bridges", "桥接线索常会产生新的中心问题，进而形成主题。"],
  ["EXAMPLE", "PERM-EXAMPLE-RELATION-MAKES-ABSTRACT-USABLE", "PERM-SUPPORT-RELATION-BECOMES-EVIDENCE", "complements", "例子补充支持关系，让抽象证据变得可理解。"],
  ["WRITING-ROLE", "PERM-WRITING-USES-RELATION-ROLES", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES", "supports", "关系角色为写作中心组织提纲提供结构。"],
  ["OUTLINE", "PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY", "PERM-DRAFT-SHOULD-KEEP-NOTE-TRACE", "precedes", "先检查提纲中的证据和边界，再进入可追溯草稿。"],
  ["TAGS", "PERM-TAGS-ARE-FAST-FILTERS-INDEXES-ARE-QUESTIONS", "PERM-THEME-INDEX-IS-ENTRY", "qualifies", "标签只负责筛选，限定了主题索引不能被分类替代。"],
  ["QUOTE", "PERM-QUOTE-IS-NOT-UNDERSTANDING", "PERM-PARAPHRASE-BEFORE-JUDGMENT", "supports", "摘录不等于理解，支撑先转述再形成判断的做法。"],
  ["ATOMIC", "PERM-ATOMIC-NOTE-ANSWERS-ONE-QUESTION", "PERM-TITLE-SHOULD-BE-A-CLAIM", "complements", "一个问题对应一个判断，补充了判断型标题的写法。"],
  ["REASON-WRITING", "PERM-RELATION-REASON-WRITES-FUTURE-PARAGRAPH", "PERM-WRITING-USES-RELATION-ROLES", "supports", "关系理由保存了未来段落可直接使用的论证线索。"],
  ["INDEX-ORDER", "PERM-INDEX-CARD-KEEPS-READING-ORDER", "PERM-INDEX-CARD-IS-LIVING-OUTLINE", "supports", "可读顺序让主题索引逐渐长成文章前身。"],
  ["DRAFT-TRACE", "PERM-DRAFT-SHOULD-KEEP-NOTE-TRACE", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES", "complements", "来源追溯补充了写作中心从已确认判断出发的要求。"],
  ["DEMO-HELP", "PERM-HELP-ARTICLES-CAN-BE-DEMO-OUTPUT", "PERM-HELP-SHOULD-FOLLOW-TASKS", "supports", "由 Demo 笔记生成帮助文章，支撑按任务解释产品。"],
  ["GAP", "PERM-GAP-RELATION-POINTS-TO-NEXT-READING", "PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY", "supports", "发现缺口能明确下一次阅读和提纲补充方向。"],
  ["BRIDGE-LIMIT", "PERM-BRIDGE-RELATION-FINDS-NEW-THEME", "PERM-LINK-TYPES-CREATE-DISCOVERY", "example_of", "桥接关系是关系类型帮助发现新主题的具体例子。"],
  ["CONTRAST-BOUNDARY", "PERM-CONTRAST-RELATION-CREATES-ARGUMENT", "PERM-BOUNDARY-MAKES-NOTE-RELIABLE", "supports", "反驳关系会迫使用户补充条件和边界。"],
  ["CAPTURE", "PERM-CAPTURE-IS-INBOX-NOT-KNOWLEDGE", "PERM-FLEETING-NOTE-IS-CAPTURE", "supports", "记录是收件箱的判断，支撑随笔只是捕捉点。"],
  ["SOURCE", "PERM-LITERATURE-NOTE-KEEPS-SOURCE-BOUNDARY", "PERM-OWN-WORDS-ARE-FIRST-THINKING", "precedes", "先分清来源与自己的话，才能完成真正转述。"],
  ["AI-DISTILL", "PERM-AI-DISTILL-DRAFT", "PERM-OWN-WORDS-ARE-FIRST-THINKING", "qualifies", "AI 草稿只能辅助重说，不能替代用户自己的理解。"],
  ["AI-RELATE", "PERM-AI-RELATION-EXPLAINS-WHY", "PERM-AI-SHOULD-ASK-FOR-CONFIRMATION", "supports", "候选关联的理由为用户确认提供依据。"],
  ["AI-CHECK", "PERM-AI-WRITING-CHECK-DOES-NOT-REWRITE", "PERM-DRAFT-SHOULD-KEEP-NOTE-TRACE", "complements", "指出写作缺口和保留笔记追溯共同保护用户观点。"],
  ["LIMIT", "PERM-LIMIT-RELATION-PROTECTS-OVERCLAIM", "PERM-SUPPORT-RELATION-BECOMES-EVIDENCE", "qualifies", "限定关系提醒证据支持到哪里为止。"],
  ["RELATED", "PERM-UNLINKED-PRACTICE", "PERM-RELATION-REASON-MATTERS", "example_of", "关系理由练习具体展示了保存前先写理由。"],
  ["THEME-WRITING", "PERM-INDEX-CARD-IS-LIVING-OUTLINE", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES", "bridges", "主题索引把关系网络桥接到写作中心。"],
  ["HOME-WRITING", "PERM-TODAY-REVIEW-REWARDS-PROCESSING", "PERM-WRITING-STARTS-BEFORE-DRAFT", "supports", "首页每天推进一条材料，支撑写作从整理阶段开始。"],
  ["MOBILE-HOME", "PERM-MOBILE-CAPTURE-DESKTOP-ORGANIZE", "PERM-HOME-AS-DAILY-DESK", "complements", "手机捕捉与电脑首页整理互相补充。"],
  ["DEMO-PRACTICE", "PERM-DEMO-IS-PRACTICE-GROUND", "PERM-FIRST-TEN-MINUTES", "supports", "可练习样例让十分钟小闭环真正可操作。"],
  ["RELATION-READ", "PERM-RELATION-TYPE-IS-A-READING-INSTRUCTION", "PERM-LINK-TYPES-CREATE-DISCOVERY", "supports", "关系类型决定未来读法，因此会影响后续发现。"],
  ["EXAMPLE-LIMIT", "PERM-EXAMPLE-RELATION-MAKES-ABSTRACT-USABLE", "PERM-LIMIT-RELATION-PROTECTS-OVERCLAIM", "complements", "具体例子与适用边界共同避免抽象观点被说过头。"],
  ["AI-MANUAL", "PERM-BACKUP-BEATS-IMPORT-EXPORT", "PERM-ROADMAP-GROWS-FROM-NOTES", "qualifies", "AI 贴近任务提供帮助，但手动主流程始终可用。"],
  ["HELP-START", "PERM-HELP-SHOULD-FOLLOW-TASKS", "PERM-BEST-PATH-STARTS-FROM-HOME", "supports", "按任务组织帮助，能让用户更快回到首页小闭环。"],
  ["BEST-PATH", "PERM-BEST-PATH-STARTS-FROM-HOME", "PERM-FIRST-TEN-MINUTES", "supports", "从首页开始推进一个动作，支撑十分钟走完第一次小闭环。"],
  ["WRITING-COUNTER", "PERM-CONTRAST-RELATION-CREATES-ARGUMENT", "PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY", "supports", "反驳关系为提纲提供必要的反方位置。"],
  ["TOPIC-BRIDGE", "PERM-BRIDGE-RELATION-FINDS-NEW-THEME", "PERM-THEME-INDEX-IS-ENTRY", "bridges", "桥接笔记产生的新问题可以进入主题索引。"],
  ["AI-BOUNDARY", "PERM-AI-SUGGESTION-IS-CANDIDATE", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES", "qualifies", "AI 只能补充候选，限定了提纲必须从用户确认内容出发。"],
  ["ONBOARDING-PRACTICE", "PERM-FIRST-TEN-MINUTES", "PERM-UNLINKED-PRACTICE", "example_of", "十分钟路径把首次上手落到一次真实的关联练习上。"],
  ["SAME-TOPIC", "PERM-INDEX-CARD-STARTS-WITH-CENTRAL-QUESTION", "PERM-INDEX-CARD-KEEPS-READING-ORDER", "same_topic", "两条笔记共同回答主题索引应该怎样组织关键笔记。"]
];

// Keep the original fixture relation ids so importing the refreshed Demo updates
// existing edges instead of leaving a second copy in an already-used Demo vault.
const existingRelationIds = [
  "REL-SUPPORT-WRITING-PARAPHRASE",
  "REL-PERMANENT-FOLLOWS-PARAPHRASE",
  "REL-QUOTE-QUALIFIES-PARAPHRASE",
  "REL-BOUNDARY-COMPLEMENTS-JUDGMENT",
  "REL-AI-CONTRADICTS-AUTO-JUDGMENT",
  "REL-INDEX-BRIDGES-WRITING",
  "REL-REUSE-SUPPORTS-INDEX",
  "REL-MOBILE-EXAMPLE-CAPTURE",
  "REL-TODAY-COMPLEMENTS-MOBILE",
  "REL-BACKUP-BRIDGES-ROADMAP",
  "REL-LINK-TYPES-EXTEND-REASON",
  "REL-FIRST-USE-RESTATES-FLOW",
  "REL-HELP-BRIDGES-DEMO",
  "REL-HOME-EXTENDS-FIRST-USE",
  "REL-COLLECTION-CONTRADICTS-PROCESSING",
  "REL-WRITING-APPEARS-IN-DRAFT",
  "REL-DEMO-CAPTURE-INBOX",
  "REL-DEMO-SOURCE-BOUNDARY",
  "REL-DEMO-OWN-WORDS",
  "REL-DEMO-ATOMIC-CLAIM",
  "REL-DEMO-TITLE-CLAIM",
  "REL-DEMO-RELATION-TYPE",
  "REL-DEMO-SUPPORT-EVIDENCE",
  "REL-DEMO-CONTRAST-ARGUMENT",
  "REL-DEMO-LIMIT-BOUNDARY",
  "REL-DEMO-BRIDGE-THEME",
  "REL-DEMO-EXAMPLE-USABLE",
  "REL-DEMO-GAP-NEXT",
  "REL-DEMO-REASON-PARAGRAPH",
  "REL-DEMO-INDEX-QUESTION",
  "REL-DEMO-INDEX-ORDER",
  "REL-DEMO-INDEX-OUTLINE",
  "REL-DEMO-TAGS-INDEX",
  "REL-DEMO-WRITING-ROLES",
  "REL-DEMO-OUTLINE-TRACE",
  "REL-DEMO-HELP-DEMO",
  "REL-DEMO-HOME-PATH",
  "REL-DEMO-AI-CONFIRM",
  "REL-DEMO-FIRST-TEN",
  "REL-DEMO-FIRST-RUN-SUPPORTS-FIRST-USE",
  "REL-DEMO-INDEX-WRITING"
];

function relationPairKey(from = "", to = "") {
  return [String(from || "").trim(), String(to || "").trim()].sort().join("::");
}

function safeRelationIdPart(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function manualRelations() {
  return relationSeeds.flatMap(([suffix, from, to, relationType, rationale], index) => {
    if (!CORE_PERMANENT_IDS.has(from) || !CORE_PERMANENT_IDS.has(to)) return [];
    return [{
      id: existingRelationIds[index] || `REL-DEMO-V3-${String(index + 1).padStart(2, "0")}-${suffix}`,
      from,
      to,
      relationType,
      status: "confirmed",
      rationale,
      source: "manual",
      relationSource: "manual",
      insight_question: "这条关系在以后思考或写作时，可以作为证据、反方、边界、例子还是过渡？",
      confidence: 1
    }];
  });
}

function wikilinkTargets(body = "") {
  const targets = [];
  for (const match of String(body || "").matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const target = String(match[1] || "").trim();
    if (target) targets.push(target);
  }
  return targets;
}

function buildBodyWikilinkRelations({ notes = [], permanentNotes = [], existingRelations = [] } = {}) {
  const permanentByTitle = new Map();
  const permanentById = new Map();
  for (const note of permanentNotes) {
    if (note?.id) permanentById.set(String(note.id), note);
    if (note?.title) permanentByTitle.set(String(note.title), note);
  }

  const existingPairs = new Set(existingRelations.map((relation) => relationPairKey(relation.from, relation.to)));
  const createdPairs = new Set();
  const relations = [];
  for (const note of notes) {
    const from = String(note?.id || "").trim();
    if (!from) continue;
    for (const target of wikilinkTargets(note?.body || "")) {
      const targetNote = permanentByTitle.get(target) || permanentById.get(target);
      const to = String(targetNote?.id || "").trim();
      if (!to || to === from) continue;
      const pairKey = relationPairKey(from, to);
      if (existingPairs.has(pairKey) || createdPairs.has(pairKey)) continue;
      createdPairs.add(pairKey);
      relations.push({
        id: `REL-DEMO-BODY-${safeRelationIdPart(from)}-${safeRelationIdPart(to)}`,
        from,
        to,
        relationType: "associated_with",
        status: "confirmed",
        rationale: "markdown_wikilink",
        source: "body_wikilink",
        relationSource: "body_wikilink",
        insight_question: "正文里出现了这个链接。后续如果它支撑写作，再补一句清楚的关联理由。",
        confidence: 0.55
      });
    }
  }
  return relations;
}

function buildRelations({ notes = [], permanentNotes = [] } = {}) {
  const explicitRelations = manualRelations();
  return [
    ...explicitRelations,
    ...buildBodyWikilinkRelations({ notes, permanentNotes, existingRelations: explicitRelations })
  ];
}

function writingProject() {
  const sections = [
    ["把材料加工成自己的判断", ["PERM-FLEETING-NOTE-IS-CAPTURE", "PERM-PARAPHRASE-BEFORE-JUDGMENT", "PERM-PERMANENT-NOTE-IS-JUDGMENT"]],
    ["为什么要写清关联", ["PERM-RELATION-REASON-MATTERS", "PERM-SUPPORT-RELATION-BECOMES-EVIDENCE", "PERM-COMPOUND-INTEREST-FROM-REUSE"]],
    ["主题如何进入写作", ["PERM-THEME-INDEX-IS-ENTRY", "PERM-INDEX-CARD-IS-LIVING-OUTLINE", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES"]],
    ["为什么要保留反方和边界", ["PERM-CONTRAST-RELATION-CREATES-ARGUMENT", "PERM-BOUNDARY-MAKES-NOTE-RELIABLE", "PERM-OUTLINE-NEEDS-EVIDENCE-COUNTERPOINT-BOUNDARY"]]
  ].map(([title, noteIds], index) => ({ sectionId: `sec-${index + 1}`, title, goal: `用关键笔记说清“${title}”。`, noteTraceIds: noteIds, literatureTraceIds: [], keyNoteTraceIds: noteIds.slice(0, 1), openQuestion: "还需要补一个更具体的使用例子吗？", gap: "避免抽象术语，落到用户动作。", counterpoint: "这一步能否继续简化？" }));
  return {
    id: "WRITE-SMART-NOTES-DEMO",
    title: "怎样把已有笔记变成清晰观点和写作结构",
    goal: "用真实 Demo 笔记展示：先形成自己的判断，再通过关系和主题进入可追溯的写作结构。",
    intent: "解释核心方法和当前产品，不写宣传稿。",
    target_reader: "第一次使用研思录的人。",
    desired_reader_takeaway: "我能看见一条判断怎样带着来源和关系进入可追溯提纲，再开始写作。",
    basketNoteIds: sections.flatMap((section) => section.noteTraceIds),
    indexCardIds: ["THEME-WHAT-IS-PERMANENT-NOTE", "THEME-WHY-LINK-NOTES", "THEME-INDEX-TO-WRITING"],
    keyNoteIds: ["PERM-PERMANENT-NOTE-IS-JUDGMENT", "PERM-RELATION-REASON-MATTERS", "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES"],
    outline: sections,
    template: { type: "writing_project", starting_point: "theme_index_and_confirmed_notes" }
  };
}

function scaffold(project, id) {
  return {
    id,
    writing_project_id: project.id,
    generated_by: "demo-fixture",
    version_note: project.id === "WRITE-SMART-NOTES-DEMO"
      ? "由判断、关系理由和主题索引组成的示例提纲；每一节都可追溯到关键笔记。"
      : "从主题索引和关键笔记生成的示例提纲，可由用户继续修改。",
    key_note_ids: project.keyNoteIds,
    key_note_path: project.keyNoteIds,
    sections: project.outline.map((section) => ({
      id: section.sectionId,
      title: section.title,
      goal: section.goal,
      note_ids: section.noteTraceIds,
      literature_note_ids: section.literatureTraceIds,
      key_note_ids: section.keyNoteTraceIds,
      open_question: section.openQuestion,
      gap: section.gap,
      counterpoint: section.counterpoint
    }))
  };
}

function guideNotes() {
  return [
    ["GUIDE-SMART-NOTES-START", "00 从这里开始：3 分钟看懂一条知识链", `你不用先学术语，只看一条链：记录材料 -> 用自己的话转述 -> 形成一条判断 -> 写清关系理由 -> 组织主题 -> 查看提纲。\n\n1. 看 [[手机上先记一句：我总是收藏很多但不会用]]。\n2. 看 [[用自己的话重说，才能检查理解]]，再看 [[永久笔记要能脱离原文使用]]。\n3. 打开 [[关系理由练习：给已有笔记补一条说明]]，选择一种关系并写一句理由。\n4. 打开 [[为什么要关联笔记？]]，再进入示例写作项目查看提纲。\n\n先跟着做一遍；不必一次理解全部功能。`],
    ["GUIDE-TODAY-NEXT-STEP", "01 今天先做哪一步？", "先处理一条材料。写成自己的判断后，再补一条有理由的关系。"],
    ["GUIDE-WHAT-PERMANENT", "02 什么是永久笔记？", "永久笔记是一条你愿意承担的判断。标题说观点，正文写理由和边界。\n\n继续看：[[永久笔记是一条用户愿意承担的判断]]。"],
    ["GUIDE-WHY-RELATE", "03 为什么要建立关系？", "关联让两条判断互相解释。选择对象、关系类型，写一句为什么相关，然后保存。\n\n继续看：[[关系理由比连线本身更重要]]。"],
    ["GUIDE-WRITABLE-THEME", "04 什么是可写主题？", "当几条永久笔记能一起回答一个问题时，就可以整理成主题索引。\n\n继续看：[[主题索引不是文件夹，而是问题入口]]。"],
    ["GUIDE-INDEX-TO-WRITING", "05 怎么从主题进入写作中心？", "打开主题，确认中心问题和关键笔记，再进入写作中心生成提纲。提纲可修改，不会自动写成文章。"],
    ["GUIDE-RELATION-TYPES", "06 关系怎么选？", "先选“支持它”“不同意它”或“让我想到它”，再写一句为什么。更细的关系以后需要时再用。"]
  ].map(([id, title, content]) => ({ id, note_type: "guide", title, status: "active", tags: ["导览", "Smart Notes Demo"], body: `# ${title}\n\n${content}` }));
}

export function buildSmartNotesDemoFixture() {
  const permanent_notes = permanentDefinitions
    .filter(([id]) => CORE_PERMANENT_IDS.has(id))
    .map(permanentNote);
  const writingProjectMain = writingProject();
  const final_essays = [
    { id: "ESSAY-SMART-NOTES-DEMO", note_type: "final_essay", title: "示例文章：把已有笔记变成写作结构", writing_project_id: writingProjectMain.id, body: "# 示例文章：把已有笔记变成写作结构\n\n研思录先把已有材料加工成用户愿意承担的判断，再用 [[关系理由比连线本身更重要]] 说明这些判断如何互相支撑，最后通过 [[写作中心应该从已确认判断生成提纲]] 组织成可追溯提纲。" }
  ];
  const guide_notes = guideNotes();
  const guideLinkTargets = {
    "GUIDE-TODAY-NEXT-STEP": "PERM-FLEETING-NOTE-IS-CAPTURE",
    "GUIDE-INDEX-TO-WRITING": "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES",
    "GUIDE-RELATION-TYPES": "PERM-RELATION-REASON-MATTERS"
  };
  guide_notes.forEach((note) => {
    const targetId = guideLinkTargets[note.id];
    if (targetId) note.body += `\n\n继续：[[${targetId}|继续阅读]]`;
  });
  const finalEssayLinkTargets = { "ESSAY-SMART-NOTES-DEMO": "PERM-COMPOUND-INTEREST-FROM-REUSE" };
  final_essays.forEach((note) => {
    const targetId = finalEssayLinkTargets[note.id];
    if (targetId) note.body += `\n\n延伸：[[${targetId}|继续阅读]]`;
  });
  const fixture = {
    id: "demo-smart-notes-product-thinking-v3",
    title: "Smart Notes Demo：卡片笔记写作法 x 研思录",
    purpose: "帮助第一次使用者用一条真实知识链，理解记录、永久笔记、关联、主题和写作怎样连续发生。",
    version: 3,
    sources: [{
      id: SOURCE_ID,
      note_type: "source",
      title: "《卡片笔记写作法》方法边界",
      author: "Sönke Ahrens",
      source_kind: "book-method-reference",
      use_boundary: "Demo 只保留方法观念和原创转述，不复刻原文，也不替代阅读原书。",
      reading_purpose: "把卡片笔记写作法变成研思录里能直接体验的流程。",
      tags: ["卡片笔记", "Smart Notes Demo"],
      body: "# 《卡片笔记写作法》方法边界\n\n本 Demo 用自己的话整理方法，只用于演示研思录当前功能。"
    }],
    fleeting_notes: fleetingDefinitions.filter(([id]) => CORE_FLEETING_IDS.has(id)).map(fleetingNote),
    literature_notes: literatureDefinitions.filter(([id]) => CORE_LITERATURE_IDS.has(id)).map(literatureNote),
    permanent_notes,
    index_cards: indexDefinitions.filter(([id]) => CORE_INDEX_IDS.has(id)).map(indexCard),
    relations: buildRelations({
      permanentNotes: permanent_notes,
      notes: [...permanent_notes, ...guide_notes, ...final_essays]
    }),
    writing_projects: [writingProjectMain],
    draft_scaffolds: [scaffold(writingProjectMain, "DRAFT-SMART-NOTES-DEMO")],
    final_essays,
    guide_notes
  };
  fixture.counts = {
    sources: fixture.sources.length,
    fleeting_notes: fixture.fleeting_notes.length,
    literature_notes: fixture.literature_notes.length,
    permanent_notes: fixture.permanent_notes.length,
    index_cards: fixture.index_cards.length,
    relations: fixture.relations.length,
    writing_projects: fixture.writing_projects.length,
    draft_scaffolds: fixture.draft_scaffolds.length,
    final_essays: fixture.final_essays.length,
    guide_notes: fixture.guide_notes.length
  };
  return fixture;
}

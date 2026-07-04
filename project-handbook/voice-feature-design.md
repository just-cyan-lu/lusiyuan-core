# Voice Feature Design

状态：第一版已实现。TTS、浏览器 ASR、语音缓存、Web Chat 自动朗读、hover 点播、语音消息和自动语音通话已经接入。

目标：给陆思源接入完整语音体验，同时保持现有文字聊天主链路作为唯一人格、记忆、工具和落库来源。

## 结论

这次语音功能采用：

```text
文字输入或语音输入
↓
如果是语音输入，先 ASR 转文字
↓
现有 chat.service.ts 主链路
↓
生成并保存陆思源文字回复
↓
MiniMax T2A WebSocket 把同一段文字渲染成语音
↓
前端播放语音，同时文字永远保留
```

不把 speech-to-speech 作为主链路。陆思源的人设、关系状态、记忆、工具调用、分条回复和复盘材料都在现有文字链路里。如果语音直接绕过它，会让“声音像思源”，但“思考和记忆不一定是思源”。

MiniMax TTS 使用已有的 `MINIMAX_API_KEY`。MiniMax T2A WebSocket 的核心流程是连接 `/ws/v1/t2a_v2`，发送 `task_start`，收到 `task_started` 后发送一个或多个 `task_continue` 文本片段，服务端返回音频 chunk，最后发送 `task_finish`。本项目默认 endpoint 跟随当前 `.env` 里的 `MINIMAX_BASE_URL=https://api.minimaxi.com/v1` 域名体系，使用 `wss://api.minimaxi.com/ws/v1/t2a_v2`。

ASR 第一版使用浏览器 Web Speech API，provider 固定为 `browser`。MiniMax 当前公开文档里没有适合通用“任意语音转文字”的开放 ASR endpoint，所以不要保留假 MiniMax ASR 后端路径。浏览器 ASR 会把识别出的文字交给现有 `/v1/chat/stream`，不会把原始录音上传到后端。

参考：

- MiniMax T2A WebSocket API: https://platform.minimax.io/docs/api-reference/speech-t2a-websocket
- MiniMax T2A WebSocket Guide: https://platform.minimax.io/docs/guides/speech-t2a-websocket
- MiniMax T2A HTTP API: https://platform.minimax.io/docs/api-reference/speech-t2a-http
- MDN SpeechRecognition: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition

## 功能目标

1. 普通聊天页永远显示文字回复。
2. 用户可以在聊天页开启语音自动播放。开启后，之后的思源回复显示文字的同时自动播放语音。
3. 每条思源回复 hover 时显示小音量按钮。点击后播放这条回复的语音。
4. 播放过的语音会缓存。缓存按最近播放时间保留，超过 7 天没有播放就删除。
5. 删除缓存后再次点击播放，要能重新生成语音。
6. 提供语音消息模式。用户手动开始说话，手动结束后把浏览器 ASR 文字发给现有聊天链路。
7. 提供自动语音通话模式。浏览器检测到停顿后自动发送文字，等待思源回复和语音队列播放完毕后继续监听下一句。
8. 语音模式也要显示用户转写文本和思源文字回复，保证可追溯、可复盘、可调试。

## 非目标

1. 不把 MiniMax TTS 接成新的模型大脑。
2. 不做绕过 `chat.service.ts` 的 speech-to-speech 主链路。
3. 不让音频替代 Message。Message 仍然保存文字，音频只是 Message 的一个可再生成播放形态。
4. 不为了旧测试数据做兼容。开发期可以直接迁移到新结构。
5. 不把音频二进制长期塞进主数据库，除非之后明确决定要这么做。

## 当前项目依赖点

现有主链路已经适合接语音增强层：

- `src/core/chat.service.ts`：生成文字回复、保存 `Message`、返回 `reply_parts`。
- `src/routes/chat.route.ts`：Web Chat SSE 输出 `ready`、`progress`、`message`、`done`。
- `src/types/chat.ts`：`ChatReplyPart` 已经有 `turn_id`、`sequence`、`kind`、`content`。
- `src/config/runtime-settings.registry.ts`：适合放非秘密语音运行配置。
- `src/utils/env.ts`：已有 `MINIMAX_API_KEY`，继续作为秘密配置来源。

需要补的关键点：

- Web Chat 历史消息接口目前没有返回 `Message.id`。语音缓存要按消息复用，需要把 `id` 暴露给前端。
- `ChatReplyPart` 需要带上对应的 `message_id`，否则新回复刚显示时前端无法直接按消息请求语音。
- 聊天 SSE 需要增加语音事件，但不能破坏现有文字事件。

## 用户体验

### 普通聊天页

聊天页顶部或输入区附近加一个小音量图标，表示“自动播放思源语音”。

状态：

- 关闭：只显示文字。hover 单条回复时仍可手动播放。
- 开启：新产生的思源回复照常显示文字，同时自动生成并播放语音。
- 播放中：图标可显示激活态，用户可以点掉以停止后续自动播放。

浏览器自动播放有权限限制，所以第一次开启时必须由用户点击触发，并在这次点击里初始化 `AudioContext` 或播放权限。

### 单条回复播放

每条 assistant 消息 hover 时显示小音量图标。

点击后：

```text
如果本地正在播放这条消息
↓
停止播放

否则
↓
请求后端播放这条 Message
↓
后端命中缓存则直接返回音频
后端未命中则调用 MiniMax TTS 生成并缓存
↓
前端播放
```

手动播放应该刷新这条缓存的 `lastPlayedAt`。

### 自动播放

开启自动播放后，新回复的处理顺序：

```text
chat SSE 收到 message 事件
↓
文字气泡立即出现
↓
后端或前端开始为该 message 请求 TTS
↓
收到音频 chunk 后进入播放队列
↓
播放队列按 message sequence 顺序播放，避免多条回复重叠
```

自动播放也算播放，必须刷新 `lastPlayedAt`。

如果当前已有语音在播放，后续语音先生成完整 Blob 或拿到缓存 `audio_url`，再进入待播队列。用户点击、滚动或键盘操作页面时，只清空待播队列，不强行停止当前正在播放的语音。

默认只自动播放 `final` assistant 消息。工具调用前的 `intermediate` 即时反应先不自动朗读，避免“我去看看”这类短句频繁打断；但 hover 手动播放仍可支持所有 assistant 消息。

### 语音电话

语音电话是一个通话感 UI，不是另一套人格链路。当前 Web Chat 同时保留两种模式：

- 语音消息：手动开始、手动结束并发送。
- 自动通话：浏览器检测到用户停顿后自动发送，思源回复和语音播放结束后继续监听下一句。

自动通话流程：

```text
用户点击语音电话
↓
点击开始通话
↓
浏览器请求麦克风权限
↓
前端启动浏览器 SpeechRecognition
↓
浏览器返回实时/最终转写文本
↓
停顿超过阈值或达到最长时长
↓
页面显示用户转写文本
↓
把文字发送给现有 /v1/chat/stream
↓
思源文字回复显示出来
↓
同一段回复进入 TTS 播放队列
↓
播放队列空闲
↓
继续监听下一句
```

这里是半双工体验：用户说完一句，思源回复一句。以后如果要做打断、抢话、持续流式 ASR，可以替换 ASR 和通话控制层，不要改 `chat.service.ts` 主链路。

## 后端模块

建议新增 `src/voice/`：

```text
src/voice/
  minimax-tts.service.ts
  voice-cache.service.ts
  voice-cleanup-scheduler.ts
  voice.route.ts
  voice.types.ts
```

### minimax-tts.service.ts

职责：

- 建立 MiniMax T2A WebSocket。
- 发送 `task_start`。
- 等待 `task_started`。
- 对一段或多段文本发送 `task_continue`。
- 把服务端返回的 hex audio chunk 转成 `Buffer`。
- 一边向调用方 yield chunk，一边累计完整音频。
- 收到 `is_final` 或结束事件后发送 `task_finish` 并关闭连接。
- 捕获 `task_failed`，返回可展示但不泄露密钥的错误。

对外接口建议：

```ts
interface TtsVoiceProfile {
  provider: "minimax";
  model: string;
  voiceId: string;
  languageBoost: string;
  speed: number;
  vol: number;
  pitch: number;
  sampleRate: number;
  bitrate: number;
  format: "mp3";
  channel: 1;
}

interface TtsChunk {
  audio: Buffer;
  index: number;
  isFinal: boolean;
  traceId?: string;
}

async function streamSpeech(input: {
  text: string;
  profile: TtsVoiceProfile;
  signal?: AbortSignal;
}): AsyncGenerator<TtsChunk, TtsCompleteResult>;
```

Node 侧需要 WebSocket 客户端。可以优先评估 Node 22 全局 `WebSocket` 是否满足鉴权 header；如果不够稳定，再加 `ws` 依赖。

### voice-cache.service.ts

职责：

- 根据 `messageId + textHash + voiceProfileHash` 找缓存。
- 缓存命中时刷新 `lastPlayedAt`。
- 缓存未命中时创建生成任务，避免同一条消息并发重复生成。
- 保存音频文件和数据库元数据。
- 提供读取音频文件流的接口。
- 清理 7 天未播放的缓存和孤儿文件。

音频本体建议放文件系统或之后接对象存储，数据库只保存元数据。这样符合“最近 7 天可清理”的需求，也避免主数据库被 mp3 二进制撑大。

默认存储位置：

```text
data/voice-cache/<yyyy-mm>/<cacheKey>.mp3
```

`data/` 应该加入 `.gitignore`，不进入仓库。

### 浏览器 ASR

第一版 ASR 不进后端服务层。`web/src/hooks/useVoiceCall.ts` 直接使用浏览器的 `SpeechRecognition` / `webkitSpeechRecognition`：

- `lang` 来自 `/v1/voice/config` 返回的 `VOICE_ASR_LANGUAGE`，默认 `zh-CN`。
- `continuous=true`，`interimResults=true`，面板展示实时识别文本。
- 用户点击结束、自动通话停顿超过 `VOICE_ASR_AUTO_SILENCE_MS`、浏览器自动结束或达到 `VOICE_ASR_MAX_DURATION_SECONDS` 时，把当前 transcript 作为普通文字发送到 `/v1/chat/stream`。
- 不上传原始录音，不生成音频临时文件，也不把 ASR 结果直接写 Message。
- Chrome/Edge 如果当前环境不支持 `SpeechRecognition`，面板提示不可用。

注意：Chrome 的 Web Speech API 不保证完全离线；浏览器可能使用平台或云端识别服务。这里选择它是因为第一版要求轻量、免费、目标浏览器固定在 Chrome/Edge，且语音只是文字聊天链路的输入方式。

以后如果需要真正本地可控 ASR，再新增 `whisper.cpp` provider，并让 `useVoiceCall` 在浏览器 ASR 不可用时上传短句音频给本地后端转写。

## 数据模型

新增表建议叫 `VoiceAudioCache`。

字段建议：

```prisma
model VoiceAudioCache {
  id               String   @id @default(cuid())
  messageId        String
  cacheKey         String   @unique
  textHash         String
  voiceProfileHash String
  provider         String
  model            String
  voiceId          String
  format           String
  mimeType         String
  sampleRate       Int
  bitrate          Int
  channel          Int
  storageKind      String   @default("file")
  storagePath      String
  byteSize         Int
  durationMs       Int?
  status           String   @default("ready")
  providerTraceId  String?
  lastPlayedAt     DateTime
  playCount        Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([messageId])
  @@index([lastPlayedAt])
  @@index([createdAt])
  @@map("voice_audio_caches")
}
```

唯一缓存键：

```text
sha256(messageId + textHash + normalizedVoiceProfileJson)
```

为什么包含 `voiceProfileHash`：

- 同一条消息换音色、语速、模型后，旧音频不能误用。
- 配置变更后可以自然生成新缓存。

为什么保留 `textHash`：

- 防止 message 内容被未来 admin 修正后误用旧音频。
- 不需要复制完整文本到缓存表。

后续如果要支持非 Message 文本试听，可以让 `messageId` 可空，并把 `sourceKind/sourceTextHash` 加进去。但当前需求只围绕聊天消息，先不要扩张。

## API 设计

### Chat SSE 扩展

`POST /v1/chat/stream` 请求体新增可选字段：

```ts
voice?: {
  autoplay?: boolean;
}
```

`ChatReplyPart` 新增：

```ts
message_id?: string;
```

现有事件保持：

- `ready`
- `progress`
- `message`
- `done`
- `cancelled`
- `error`

新增语音事件：

```ts
type VoiceStreamEvent =
  | {
      type: "voice_start";
      data: {
        message_id: string;
        cache_key: string;
        sequence: number;
        mime_type: string;
        format: "mp3";
      };
    }
  | {
      type: "voice_chunk";
      data: {
        message_id: string;
        cache_key: string;
        chunk_index: number;
        audio_base64: string;
      };
    }
  | {
      type: "voice_done";
      data: {
        message_id: string;
        cache_key: string;
        audio_url: string;
        byte_size: number;
        duration_ms?: number;
      };
    }
  | {
      type: "voice_error";
      data: {
        message_id: string;
        error: string;
      };
    };
```

规则：

- `message` 文字事件不能等待完整音频生成。
- `voice_error` 不影响文字回复成功。
- 如果自动播放关闭，不发送语音事件。
- 如果缓存已命中，可以直接发送 `voice_done` 和 `audio_url`，不必发 chunk。
- 如果缓存未命中，发送 `voice_start` 和多个 `voice_chunk`，最后 `voice_done`。

### 单条消息播放

新增：

```text
POST /v1/voice/messages/:messageId/play
```

请求体：

```ts
{
  user_id: string;
  conversation_id: string;
}
```

返回可以有两种模式：

1. 缓存命中：

```ts
{
  status: "cached";
  message_id: string;
  audio_url: string;
  mime_type: "audio/mpeg";
}
```

2. 缓存未命中时走 SSE 或 fetch stream：

```text
event: voice_start
event: voice_chunk
event: voice_done
event: voice_error
```

为了复用前端播放器，建议这个接口也用 SSE 文本事件承载 base64 chunk。

权限：

- 只能播放当前 `user_id + conversation_id` 下的 assistant message。
- Admin 页面如果需要播放任意消息，另开 admin route，不复用普通用户接口越权。

### 音频读取

新增：

```text
GET /v1/voice/audio/:cacheKey
```

行为：

- 校验访问者是否拥有这条 message 所在会话。
- 返回 `audio/mpeg` 文件流。
- 成功读取也可以刷新 `lastPlayedAt`，但主要刷新点在 play 接口。

### Voice Client Config

新增：

```text
GET /v1/voice/config
```

返回：

```ts
{
  asr: {
    enabled: boolean;
    provider: "browser";
    language: string;
    max_duration_seconds: number;
    auto_silence_ms: number;
  };
  tts: {
    enabled: boolean;
  };
}
```

这个接口只返回无秘密的前端语音配置。ASR provider 固定为浏览器，不提供 `/v1/voice/asr`，也不接收用户录音上传。语音电话识别出的文字仍由 `/v1/chat/stream` 写入 Message。

## 前端设计

建议新增：

```text
web/src/hooks/useVoicePlayback.ts
web/src/hooks/useVoiceCall.ts
web/src/components/ChatHeader.tsx
web/src/components/MessageBubble.tsx
web/src/components/VoiceCallPanel.tsx
web/src/audio/voicePlayer.ts
```

### voicePlayer.ts

职责：

- 管理全局播放队列。
- 接收完整 `audio_url` 播放缓存音频。
- 接收 `voice_chunk` 时做流式播放。
- 如果当前浏览器不稳定支持流式 mp3，就回退为收完 chunk 后 Blob 播放。
- 支持停止当前播放、清空待播队列。
- 当前正在播放时，后续语音先生成完整 Blob 或拿到 `audio_url`，再按顺序入队。

流式播放优先方案：

- Chrome/Edge：尝试 `MediaSource` + `SourceBuffer` 播放 mp3 chunk。
- 不支持时：累计 chunks，`voice_done` 后创建 Blob URL 播放。

### 聊天页状态

新增前端状态：

```ts
interface VoiceUiState {
  autoplayEnabled: boolean;
  unlocked: boolean;
  playingMessageId: string | null;
  loadingMessageIds: Set<string>;
  errorByMessageId: Record<string, string>;
}
```

`autoplayEnabled` 可以存在 `localStorage`。不要默认开启，避免浏览器权限和用户预期问题。

### 消息结构

前端 `ChatMessage` 需要补：

```ts
id: string;
metadata?: unknown;
```

历史接口也要返回 `id`。新消息从 SSE 的 `message_id` 来。

## 配置设计

`.env` 继续保存秘密：

```text
MINIMAX_API_KEY=...
```

运行配置中心新增非秘密配置：

```text
VOICE_TTS_ENABLED=true
VOICE_TTS_PROVIDER=minimax
VOICE_TTS_WS_ENDPOINT=wss://api.minimaxi.com/ws/v1/t2a_v2
VOICE_TTS_MODEL=speech-2.8-turbo
VOICE_TTS_VOICE_ID=<owner 选定的思源音色>
VOICE_TTS_LANGUAGE_BOOST=Chinese
VOICE_TTS_SPEED=1
VOICE_TTS_VOL=1
VOICE_TTS_PITCH=0
VOICE_TTS_SAMPLE_RATE=32000
VOICE_TTS_BITRATE=128000
VOICE_TTS_FORMAT=mp3
VOICE_CACHE_RETENTION_DAYS=7
VOICE_AUTOPLAY_FINAL_ONLY=true
VOICE_ASR_ENABLED=true
VOICE_ASR_PROVIDER=browser
VOICE_ASR_LANGUAGE=zh-CN
VOICE_ASR_MAX_DURATION_SECONDS=60
VOICE_ASR_AUTO_SILENCE_MS=1200
```

说明：

- `MINIMAX_API_KEY` 不进入数据库。
- voice id 不是秘密，可以进运行配置。
- ASR provider 固定为 `browser`，前端通过 `/v1/voice/config` 读取启用状态、语言、单段最长时长和自动通话停顿阈值。
- `VOICE_ASR_MAX_DURATION_SECONDS` 由前端语音电话使用，达到时长后自动结束并发送当前识别文本。
- `VOICE_ASR_AUTO_SILENCE_MS` 由自动语音通话使用，识别到这段停顿后自动发送当前这句话。

## 清理策略

语音缓存保留规则：

```text
now - lastPlayedAt > VOICE_CACHE_RETENTION_DAYS
↓
删除音频文件
↓
删除 VoiceAudioCache 行
```

调度：

- 每天凌晨跑一次清理任务。
- 服务启动时可以轻量清理一次 orphan metadata 或 orphan files。
- Admin 可以后续加手动清理按钮，但不是第一优先级。

失败处理：

- 文件删除失败时记录 warn，不阻塞其它缓存清理。
- 数据库行删除成功但文件残留，下一次 orphan file 清理处理。
- 文件不存在但行存在，删除行。

## 错误和降级

TTS 失败：

- 文字回复仍然成功。
- 前端显示小的播放失败状态。
- 后端不重试太多次，避免一条消息烧太多字符。

缓存写入失败：

- 可以继续把 chunk 播放给当前用户。
- `voice_done` 标记为未缓存或返回错误。

用户中途关闭自动播放：

- 停止前端播放队列。
- 后端正在生成的 TTS 如果能取消就取消；如果已经快完成，可以允许落缓存但不再播放。

用户发送新消息打断：

- 停止当前播放。
- 不删除已生成缓存。

## 安全和权限

1. 普通 voice play 接口必须校验 `user_id + conversation_id + messageId` 归属。
2. 只允许播放 assistant 消息，不允许普通接口任意 TTS 用户输入，避免变成公开 TTS 代理。
3. TTS 请求只使用数据库里已经保存的 Message content，避免前端伪造文本刷接口。
4. 错误信息不要返回 MiniMax API Key、完整鉴权 header 或内部文件路径。
5. 语音电话第一版不把用户原始录音上传后端；浏览器 ASR 只把转写文字交给聊天主链路。

## 实施顺序

1. 加 Prisma 表 `VoiceAudioCache`，补 `data/voice-cache` 的 gitignore。
2. 扩展历史消息接口和 `ChatReplyPart`，让前端拿到 `Message.id`。
3. 加运行配置项和 env 读取说明。
4. 实现 `voice-cache.service.ts`，先用假 TTS fixture 测缓存命中、lastPlayedAt 和清理。
5. 实现 `minimax-tts.service.ts`，接 MiniMax WebSocket。
6. 实现 `/v1/voice/config`、`/v1/voice/messages/:messageId/play` 和 `/v1/voice/audio/:cacheKey`。
7. 扩展 `/v1/chat/stream`，在 `voice.autoplay=true` 时发送语音事件。
8. 前端加自动播放开关、hover 播放按钮和播放队列。
9. 实现语音电话 UI，使用浏览器 SpeechRecognition 转写后再走 `/v1/chat/stream`。
10. 更新 `project-map.md`、`flows.md`、`data-map.md`、`configuration.md`，把已落地入口同步到手册。

## 测试点

后端：

- 缓存键包含 message、文本 hash 和 voice profile hash。
- 同一条消息重复播放命中缓存，并刷新 `lastPlayedAt`。
- 配置里的 voice id 或模型变化后不会误用旧缓存。
- 7 天未播放缓存会被删除。
- 普通用户不能播放别人的消息。
- TTS 失败不影响 chat 文字回复。
- AbortSignal 可以取消未完成的 TTS。
- `/v1/voice/config` 只返回无秘密配置。
- 后端不提供 `/v1/voice/asr`，不接收用户原始录音。

前端：

- 自动播放关闭时只显示文字。
- 自动播放开启后，新回复文字立即显示，语音按顺序播放。
- hover 按钮只在 assistant 消息上出现。
- 点击同一条播放按钮能播放、停止、再次播放。
- 浏览器不支持流式播放时能回退到完整 Blob 播放。
- 语音电话模式会显示用户转写文本和思源文字回复。
- 浏览器不支持 SpeechRecognition 时，语音电话面板能明确提示不可用。
- ASR 失败不会写入用户 Message。

集成：

- 新回复自动播放后，刷新页面再点同一条消息，应命中缓存。
- 把 `lastPlayedAt` 改到 8 天前，跑清理后音频文件和缓存行都消失。
- 删除缓存后再次播放，会重新调用 TTS 并生成新缓存。

## 待确认

1. 思源最终使用哪个 MiniMax `voice_id`。
2. 语音电话默认用当前 Web Chat 会话，还是每次电话新建一个会话。
3. 自动播放是否永远只读 final 回复，还是允许读工具调用前的 intermediate 短句。
4. 音频文件放本地 `data/voice-cache`，还是直接接对象存储。
5. 如果浏览器 ASR 在 Edge 上不稳定，是否补一个 `whisper.cpp` 本地后端 provider。

# 多条回复功能

这份文档记录当前多条回复机制。早期版本曾经把中间消息做成一个模型可调用工具；该工具已经删除，避免和 `REPLY_DELIVERY_MODE=hybrid` 的自动中间消息重复。

## 当前实现

- `REPLY_DELIVERY_MODE=single`：最终回复只发一条。
- `REPLY_DELIVERY_MODE=final_blocks`：只把最终回复按自然边界拆成多条。
- `REPLY_DELIVERY_MODE=hybrid`：工具调用阶段可以先发中间消息，最终回复也会按自然边界拆条。

## hybrid 的中间消息来源

当前没有独立的“发送中间消息工具”。hybrid 模式下只保留两种自动来源：

1. 模型在请求工具时同时返回了可见文本，系统会把这段文本作为中间消息发送。
2. 某些 provider 只返回隐藏思考和工具调用时，系统会额外请求一句短反应，例如“我先看看”。

这两种消息都会写入 `Message`，并标记为 `isIntermediate: true`。

## 相关代码

- `src/core/chat.service.ts`
- `src/core/reply-segmentation.service.ts`
- `src/types/chat.ts`

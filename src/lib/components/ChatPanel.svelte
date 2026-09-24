<script lang="ts">
    import { app } from "$lib/stores.svelte";
    import { sendMessage, clearChat, stopGeneration } from "$lib/llmClient";
    import { t } from "$lib/i18n";

    let input = $state("");
    let messagesEl: HTMLDivElement | undefined = $state();

    async function submit() {
      const text = input.trim();
      if (!text || app.isGenerating) return;
      input = "";
      await sendMessage(text, () => {
        queueMicrotask(() => {
          if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        });
      });
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    }
</script>

<div class="chat-panel glass">
  <header class="chat-header">
    <div class="title">
      <span class="dot"></span>
      <span>{t("chat.title")}</span>
    </div>
    <button class="btn btn-ghost small" onclick={clearChat}>{t("chat.clear")}</button>
  </header>

  <div class="messages scrollable" bind:this={messagesEl}>
    {#if app.messages.length === 0}
      <div class="empty">
        <p>{t("chat.empty")}</p>
        <p class="hint">{t("chat.hint")}</p>
      </div>
    {/if}

    {#each app.messages as msg, i (i)}
      <div class="msg {msg.role}">
        <div class="role">{msg.role === "user" ? t("chat.you") : t("chat.ai")}</div>
        <div class="content">
          {msg.content}{#if msg.streaming}<span class="cursor">▌</span>{/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="composer">
    <textarea
      bind:value={input}
      placeholder={t("chat.placeholder")}
      rows={3}
      onkeydown={onKeydown}
      disabled={app.isGenerating}
    ></textarea>

    {#if app.isGenerating}
      <button
        class="btn btn-danger send-btn"
        onclick={stopGeneration}
        title={t("chat.stop")}
      >
        ⏹
      </button>
    {:else}
      <button
        class="btn send-btn"
        onclick={submit}
        disabled={!input.trim()}
        title={t("chat.send")}
      >
        →
      </button>
    {/if}
  </div>
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 14px;
    gap: 12px;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--text-0);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--orange-1);
    box-shadow: 0 0 10px var(--orange-1);
  }

  .small {
    padding: 4px 10px;
    font-size: 12px;
  }

  .messages {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 4px;
    min-height: 0;
  }

  .empty {
    color: var(--text-2);
    padding: 12px;
    font-size: 13px;
  }

  .hint {
    margin-top: 8px;
    color: var(--text-2);
    font-size: 12px;
    opacity: 0.75;
  }

  .msg {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid transparent;
  }

  .msg.user {
    background: rgba(255, 122, 26, 0.08);
    border-color: rgba(255, 122, 26, 0.20);
    align-self: flex-end;
    max-width: 92%;
  }

  .msg.assistant {
    background: rgba(155, 109, 255, 0.08);
    border-color: rgba(155, 109, 255, 0.22);
    max-width: 96%;
  }

  .role {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-2);
    font-weight: 600;
  }

  .content {
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-0);
    font-size: 13px;
  }

  .cursor {
    display: inline-block;
    color: var(--orange-1);
    animation: blink 0.9s step-end infinite;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  .composer {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .composer textarea {
    flex: 1;
  }

  .send-btn {
    height: 44px;
    width: 44px;
    padding: 0;
    font-size: 18px;
    border-radius: 10px;
  }
</style>

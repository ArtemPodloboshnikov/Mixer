<script lang="ts">
  export interface DropdownOption {
    value: string;
    label: string;
  }

  let {
    value = $bindable(""),
    options,
    placeholder,
    disabled = false,
    minWidth = "180px",
    openDown = false,
    onChange,
  }: {
    value: string;
    /** Либо массив строк, либо массив пар { value, label } */
    options: string[] | DropdownOption[];
    placeholder?: string;
    disabled?: boolean;
    minWidth?: string;
    /** true — открывать список снизу от поля, false — сверху */
    openDown?: boolean;
    onChange?: (value: string) => void;
  } = $props();

  let open = $state(false);
  let rootEl: HTMLDivElement | undefined = $state();

  // Приводим опции к единому виду { value, label }
  const normalized = $derived(
    options.map((o) =>
      typeof o === "string" ? { value: o, label: o } : o
    )
  );

  // Что показывать в триггере, когда value пустой
  const currentLabel = $derived(
    normalized.find((o) => o.value === value)?.label ?? ""
  );

  function toggle() {
    if (disabled || normalized.length === 0) return;
    open = !open;
  }

  function choose(optValue: string) {
    value = optValue;
    open = false;
    onChange?.(optValue);
  }

  function onDocumentClick(e: MouseEvent) {
    if (!open) return;
    if (rootEl && !rootEl.contains(e.target as Node)) {
      open = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      open = false;
    }
  }

  $effect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("click", onDocumentClick);
    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("click", onDocumentClick);
      window.removeEventListener("keydown", onKeydown);
    };
  });
</script>

<div class="dropdown" bind:this={rootEl} style="--dropdown-min-width: {minWidth};">
  <button
    class="dropdown-trigger"
    class:disabled={disabled || normalized.length === 0}
    onclick={(e) => {
      e.stopPropagation();
      toggle();
    }}
    disabled={disabled || normalized.length === 0}
  >
    <span class="dropdown-label">
      {currentLabel || placeholder}
    </span>
    <span class="dropdown-arrow" class:open>▾</span>
  </button>

  {#if open}
    <ul class="dropdown-menu" class:open-down={openDown}>
      {#each normalized as opt (opt.value)}
        <li>
          <button
            class="dropdown-item"
            class:selected={opt.value === value}
            onclick={() => choose(opt.value)}
          >
            <span class="check">{opt.value === value ? "✓" : ""}</span>
            <span>{opt.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .dropdown {
    position: relative;
    min-width: var(--dropdown-min-width, 180px);
  }

  .dropdown-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(10, 8, 16, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.10);
    color: var(--text-0);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .dropdown-trigger:hover:not(.disabled) {
    border-color: var(--orange-1);
    box-shadow: 0 0 0 3px rgba(255, 122, 26, 0.12);
  }

  .dropdown-trigger:focus-visible {
    outline: none;
    border-color: var(--orange-1);
    box-shadow: 0 0 0 3px rgba(255, 122, 26, 0.20);
  }

  .dropdown-trigger.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dropdown-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-arrow {
    color: var(--orange-2);
    font-size: 18px;
    transition: transform 0.18s ease;
  }

  .dropdown-arrow.open {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    left: 0;
    right: 0;
    margin: 0;
    padding: 6px;
    list-style: none;
    border-radius: 12px;
    background: rgba(20, 18, 25, 0.92);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid var(--glass-border);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.55),
      inset 0 1px 0 rgba(255, 180, 120, 0.08);
    z-index: 50;
    max-height: 220px;
    overflow-y: auto;
    animation: dropdown-in 0.14s ease;
  }

  /* По умолчанию — вверх */
  .dropdown-menu {
    bottom: calc(100% + 6px);
  }

  /* openDown = true — вниз */
  .dropdown-menu.open-down {
    bottom: auto;
    top: calc(100% + 6px);
  }

  @keyframes dropdown-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes dropdown-in-down {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dropdown-menu.open-down {
    animation-name: dropdown-in-down;
  }

  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--text-1);
    font-family: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: all 0.14s ease;
  }

  .dropdown-item:hover {
    background: rgba(255, 122, 26, 0.10);
    color: var(--orange-2);
  }

  .dropdown-item.selected {
    background: rgba(255, 122, 26, 0.14);
    color: var(--orange-1);
  }

  .dropdown-item .check {
    width: 14px;
    display: inline-block;
    color: var(--orange-1);
    font-size: 12px;
    flex-shrink: 0;
  }
</style>

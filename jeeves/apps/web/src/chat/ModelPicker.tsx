/**
 * The chat composer's model button and its menu, as the preview's chat mock draws them. The button
 * shows a dot (green when the design model's provider is connected, red when not), the model's
 * name and its provider. The menu has one section per provider, headed by its name and status,
 * then each model with its context size and its prices per million tokens (input / output) where
 * models.dev knows them; the selected one is on yellow. A provider that isn't connected has one
 * disabled row, "Connect it in Settings"; the custom endpoint, when models.dev doesn't know its
 * host, takes a typed model name. A pick saves through `PUT /settings/roles` and applies to the
 * next message.
 */
import { Menu, TextInput } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { type ReactNode, useEffect, useState } from "react";
import type { ModelOption, ProviderModels, RoleModel } from "../project/api.ts";
import { useChat } from "./store.ts";

/** The longest model name the server keeps. */
const MODEL_NAME_MAX = 100;

const oneDecimal = (value: number) => String(Number(value.toFixed(1)));

/** A context size as the picker writes it: `128k`, `500k`, `1M`, `1.5M`. */
export function contextLabel(tokens: number | null): string | null {
  if (tokens === null) return null;
  if (tokens >= 1_000_000) return `${oneDecimal(tokens / 1_000_000)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return String(tokens);
}

function dollars(amount: number) {
  if (Number.isInteger(amount)) return `$${amount}`;
  const cents = amount.toFixed(2);
  return Number(cents) === amount ? `$${cents}` : `$${Number(amount.toFixed(4))}`;
}

/** Input and output prices per million tokens, `$0.10 / $0.50`, when both are known. */
export function priceLabel(input: number | null, output: number | null): string | null {
  return input === null || output === null ? null : `${dollars(input)} / ${dollars(output)}`;
}

function ModelFacts({ model }: { model: ModelOption }) {
  const context = contextLabel(model.contextWindow);
  const price = priceLabel(model.inputPrice, model.outputPrice);
  if (!context && !price) return null;
  return (
    <span className="chat-model-facts">
      {context ? (
        <small className="chat-model-fact" title="Context size, in tokens">
          {context}
        </small>
      ) : null}
      {price ? (
        <small className="chat-model-fact" title="US dollars per million input / output tokens">
          {price}
        </small>
      ) : null}
    </span>
  );
}

/** The custom endpoint's model, typed, when models.dev doesn't list its host's models. */
function CustomModel({
  current,
  onPick,
}: {
  current: string | undefined;
  onPick: (model: string) => void;
}) {
  const [value, setValue] = useState(current ?? "");
  const model = value.trim();
  return (
    <form
      className="chat-model-custom"
      onSubmit={(event) => {
        event.preventDefault();
        if (model) onPick(model);
      }}
    >
      <TextInput
        className="chat-model-custom-input"
        size="xs"
        aria-label="Custom endpoint model"
        placeholder="Model name"
        autoComplete="off"
        spellCheck={false}
        maxLength={MODEL_NAME_MAX}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      <button type="submit" className="chat-model-use" disabled={!model}>
        Use
      </button>
    </form>
  );
}

function ProviderSection({
  provider,
  selected,
  onPick,
}: {
  provider: ProviderModels;
  selected: RoleModel | undefined;
  onPick: (choice: RoleModel) => void;
}) {
  const current = selected?.provider === provider.id ? selected.model : undefined;
  const heading = `${provider.name} · ${provider.status}`;
  let rows: ReactNode;
  if (!provider.ready) {
    rows = (
      <Menu.Item className="chat-model-option" disabled>
        Connect it in Settings
      </Menu.Item>
    );
  } else if (provider.id === "custom" && provider.models.length === 0) {
    rows = (
      <CustomModel current={current} onPick={(model) => onPick({ provider: provider.id, model })} />
    );
  } else {
    rows = provider.models.map((model) => (
      <Menu.RadioItem
        key={model.id}
        className="chat-model-option"
        classNames={{ itemIndicator: "chat-model-indicator" }}
        value={model.id}
        checked={model.id === current}
        closeMenuOnClick
        title={model.id}
        rightSection={<ModelFacts model={model} />}
        onChange={() => onPick({ provider: provider.id, model: model.id })}
      >
        {model.name}
      </Menu.RadioItem>
    ));
  }
  return (
    <div className="chat-model-group" data-provider={provider.id}>
      <Menu.Label className="chat-model-section">
        <span className="chat-model-dot" data-ready={provider.ready} aria-hidden="true" />
        {heading}
      </Menu.Label>
      {rows}
    </div>
  );
}

export function ModelPicker() {
  const models = useChat((s) => s.models);
  const error = useChat((s) => s.modelsError);
  const loadModels = useChat((s) => s.loadModels);
  const pickModel = useChat((s) => s.pickModel);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const selected = models?.selected;
  const provider = models?.providers.find((p) => p.id === selected?.provider);
  const name = selected
    ? (provider?.models.find((m) => m.id === selected.model)?.name ??
      (selected.model || "Default model"))
    : "Model";
  const pick = (choice: RoleModel) => {
    setOpened(false);
    void pickModel(choice);
  };

  return (
    <Menu
      opened={opened}
      onChange={(next) => {
        setOpened(next);
        // Each opening asks again, so a provider connected in Settings shows at once.
        if (next) void loadModels();
      }}
      position="top-start"
      offset={6}
      width={330}
      withinPortal
      zIndex={4000}
    >
      <Menu.Target>
        <button
          type="button"
          className="chat-model-button"
          aria-label={`Design model: ${name}${provider ? `, ${provider.name}` : ""}`}
          title={provider ? `${name} · ${provider.name}` : name}
        >
          <span
            className="chat-model-dot"
            data-ready={provider?.ready ?? false}
            aria-hidden="true"
          />
          <span className="chat-model-name">{name}</span>
          {provider ? <span className="chat-model-provider">· {provider.name}</span> : null}
          <IconChevronDown className="chat-model-chevron" size={14} stroke={2.4} aria-hidden />
        </button>
      </Menu.Target>
      <Menu.Dropdown className="chat-model-menu">
        {error ? (
          <p className="chat-model-error" role="alert">
            {error}
          </p>
        ) : null}
        {!models && !error ? <p className="chat-model-note">Loading models…</p> : null}
        {models?.providers.map((p) => (
          <ProviderSection key={p.id} provider={p} selected={selected} onPick={pick} />
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

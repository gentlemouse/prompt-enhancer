import { describe, expect, it } from 'vitest';
import { setButtonStreaming, type ButtonState } from '@content/ui/button';

type FakeClassList = {
  add: (...tokens: string[]) => void;
  remove: (...tokens: string[]) => void;
  contains: (token: string) => boolean;
};

const createClassList = (): FakeClassList => {
  const tokens = new Set<string>();

  return {
    add: (...nextTokens: string[]) => {
      nextTokens.forEach(token => tokens.add(token));
    },
    remove: (...nextTokens: string[]) => {
      nextTokens.forEach(token => tokens.delete(token));
    },
    contains: (token: string) => tokens.has(token),
  };
};

const createButtonState = (): ButtonState => {
  const buttonAttributes = new Map<string, string>();
  const buttonClassList = createClassList();
  const iconStyle = { display: 'flex' };
  const loaderStyle = { display: 'none' };

  const button = {
    classList: buttonClassList,
    style: {},
    title: '',
    setAttribute: (name: string, value: string) => {
      buttonAttributes.set(name, value);
    },
    removeAttribute: (name: string) => {
      buttonAttributes.delete(name);
    },
    getAttribute: (name: string) => buttonAttributes.get(name) ?? null,
  } as unknown as HTMLElement;

  const iconEl = {
    innerHTML: '',
    style: iconStyle,
  } as unknown as HTMLElement;

  const loader = {
    style: loaderStyle,
  } as unknown as HTMLElement;

  return {
    container: {} as HTMLElement,
    button,
    iconEl,
    loader,
    onboardingEl: null,
  };
};

describe('setButtonStreaming', () => {
  it('switches the button into a stoppable streaming state', () => {
    const state = createButtonState();

    setButtonStreaming(state, true);

    expect(state.button.classList.contains('streaming')).toBe(true);
    expect(state.button.classList.contains('generating')).toBe(true);
    expect(state.button.classList.contains('stoppable')).toBe(true);
    expect(state.button.getAttribute('aria-disabled')).toBeNull();
    expect(state.button.getAttribute('aria-label')).toBe('btnAriaStopGenerating');
    expect(state.iconEl?.innerHTML).toContain('<rect');
  });

  it('restores the default icon and accessibility text when streaming ends', () => {
    const state = createButtonState();

    setButtonStreaming(state, true);
    setButtonStreaming(state, false);

    expect(state.button.classList.contains('streaming')).toBe(false);
    expect(state.button.classList.contains('generating')).toBe(false);
    expect(state.button.classList.contains('stoppable')).toBe(false);
    expect(state.button.getAttribute('aria-label')).toBe('btnAriaLabel');
    expect(state.iconEl?.innerHTML).toContain('<path');
  });
});

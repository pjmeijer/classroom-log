import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ToastUndoEdit } from '../ToastUndoEdit';

describe('ToastUndoEdit', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('renders "Gemt for {name}" and the two actions', () => {
    const { getByText } = render(
      <ToastUndoEdit studentName="Stine" onUndo={jest.fn()} onEdit={jest.fn()} onTimeout={jest.fn()} />
    );
    expect(getByText('Gemt for Stine')).toBeTruthy();
    expect(getByText('Fortryd')).toBeTruthy();
    expect(getByText('Redigér')).toBeTruthy();
  });

  it('calls onTimeout after 5 seconds', () => {
    const onTimeout = jest.fn();
    render(<ToastUndoEdit studentName="Stine" onUndo={jest.fn()} onEdit={jest.fn()} onTimeout={onTimeout} />);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(onTimeout).toHaveBeenCalled();
  });

  it('pressing Fortryd cancels the timeout and calls onUndo', () => {
    const onUndo = jest.fn();
    const onTimeout = jest.fn();
    const { getByText } = render(
      <ToastUndoEdit studentName="Stine" onUndo={onUndo} onEdit={jest.fn()} onTimeout={onTimeout} />
    );
    fireEvent.press(getByText('Fortryd'));
    expect(onUndo).toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

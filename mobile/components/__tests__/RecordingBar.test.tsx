import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecordingBar } from '../RecordingBar';

describe('RecordingBar', () => {
  it('renders Optager + timer + Stop & gem + Annuller', () => {
    const { getByText } = render(
      <RecordingBar startedAt={Date.now()} onStop={jest.fn()} onCancel={jest.fn()} />
    );
    expect(getByText(/Optager/)).toBeTruthy();
    expect(getByText('Stop & gem')).toBeTruthy();
    expect(getByText('Annuller')).toBeTruthy();
  });
  it('onStop and onCancel fire from their buttons', () => {
    const onStop = jest.fn();
    const onCancel = jest.fn();
    const { getByText } = render(<RecordingBar startedAt={Date.now()} onStop={onStop} onCancel={onCancel} />);
    fireEvent.press(getByText('Stop & gem'));
    fireEvent.press(getByText('Annuller'));
    expect(onStop).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});

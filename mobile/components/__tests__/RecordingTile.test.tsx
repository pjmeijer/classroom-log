import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecordingTile } from '../RecordingTile';

describe('RecordingTile', () => {
  it('renders the student name and the recording label', () => {
    const { getByText } = render(
      <RecordingTile
        studentName="Stine"
        startedAt={Date.now()}
        onStop={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(getByText('Stine')).toBeTruthy();
    expect(getByText('Optager')).toBeTruthy();
  });

  it('calls onStop when Stop & gem is pressed', () => {
    const onStop = jest.fn();
    const { getByText } = render(
      <RecordingTile studentName="Stine" startedAt={Date.now()} onStop={onStop} onCancel={jest.fn()} />
    );
    fireEvent.press(getByText('Stop & gem'));
    expect(onStop).toHaveBeenCalled();
  });

  it('calls onCancel when Annuller is pressed', () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <RecordingTile studentName="Stine" startedAt={Date.now()} onStop={jest.fn()} onCancel={onCancel} />
    );
    fireEvent.press(getByText('Annuller'));
    expect(onCancel).toHaveBeenCalled();
  });
});

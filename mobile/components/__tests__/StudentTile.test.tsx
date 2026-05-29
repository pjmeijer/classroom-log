import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StudentTile } from '../StudentTile';

describe('StudentTile', () => {
  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<StudentTile name="Stine" index={0} onPress={onPress} onLongPress={jest.fn()} />);
    fireEvent.press(getByLabelText(/Stine/));
    expect(onPress).toHaveBeenCalled();
  });

  it('fires onLongPress when long-pressed', () => {
    const onLongPress = jest.fn();
    const { getByLabelText } = render(<StudentTile name="Stine" index={0} onPress={jest.fn()} onLongPress={onLongPress} />);
    fireEvent(getByLabelText(/Stine/), 'longPress');
    expect(onLongPress).toHaveBeenCalled();
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<StudentTile name="Stine" index={0} onPress={onPress} onLongPress={jest.fn()} disabled />);
    fireEvent.press(getByLabelText(/Stine/));
    expect(onPress).not.toHaveBeenCalled();
  });
});

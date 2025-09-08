// /components/SelectableTile.js
import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

const SelectableTile = ({ item, selected, onPress }) => {
  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      style={{
        borderWidth: 1,
        borderColor: selected ? '#333' : '#ccc',
        padding: 12,
        margin: 6,
        borderRadius: 8,
      }}
    >
      <View>
        <Text style={{ fontWeight: '600' }}>{item.title || item.name}</Text>
        {item.subtitle ? <Text>{item.subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
};

export default SelectableTile;

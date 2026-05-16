import { Feather, Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

const ACTIVE = '#4F8CFF';
const INACTIVE = '#7B8BA8';
const SIZE = 24;

type TabName = 'home' | 'learn' | 'immersion' | 'profile';

export function StudentTabIcon({
  name,
  focused,
}: {
  name: TabName;
  focused: boolean;
}) {
  const color = focused ? ACTIVE : INACTIVE;

  return (
    <View style={styles.wrap}>
      {focused ? <View style={styles.indicator} /> : null}
      {renderIcon(name, focused, color)}
    </View>
  );
}

function renderIcon(name: TabName, focused: boolean, color: string) {
  switch (name) {
    case 'home':
      return (
        <Ionicons
          name={focused ? 'home' : 'home-outline'}
          size={SIZE}
          color={color}
        />
      );
    case 'learn':
      return <Feather name="book-open" size={SIZE} color={color} />;
    case 'immersion':
      return <Feather name="map-pin" size={SIZE} color={color} />;
    case 'profile':
      return <Feather name="user" size={SIZE} color={color} />;
  }
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 30,
  },
  indicator: {
    position: 'absolute',
    top: -10,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACTIVE,
  },
});

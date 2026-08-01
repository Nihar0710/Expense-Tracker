import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function FavoritesRow({ favorites, onPress }) {
  const { colors } = useTheme();
  if (!favorites || favorites.length === 0) return null;

  const s = makeStyles(colors);

  return (
    <View style={s.wrapper}>
      <Text style={s.heading}>Quick pay</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {favorites.slice(0, 10).map((fav) => {
          const initials = (fav.name || fav.upi_id)
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() ?? '')
            .join('');

          return (
            <TouchableOpacity
              key={fav.id}
              style={s.item}
              onPress={() => onPress(fav)}
              activeOpacity={0.75}
            >
              <View style={s.avatar}>
                <Text style={s.initials}>{initials || '?'}</Text>
              </View>
              <Text style={s.name} numberOfLines={1}>{fav.name || fav.upi_id}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(c) {
  const AVATAR = rs(52);
  return StyleSheet.create({
    wrapper:  { marginTop: spacing.xl },
    heading:  { fontSize: fontSize.base, fontWeight: '700', color: c.text, marginBottom: spacing.md },
    scroll:   { gap: spacing.xl, paddingRight: spacing.sm },
    item:     { alignItems: 'center', width: rs(64) },
    avatar:   {
      width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
      backgroundColor: c.cardAlt,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    initials: { fontSize: fontSize.lg, fontWeight: '700', color: c.accent },
    name:     { fontSize: fontSize.xs, color: c.textFaint, marginTop: spacing.xs, textAlign: 'center', width: '100%' },
  });
}

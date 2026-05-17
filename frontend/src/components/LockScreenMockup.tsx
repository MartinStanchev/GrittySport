import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/fonts';

export interface NotificationPreview {
  appName: string;
  title: string;
  body: string;
  timeAgo?: string;
  appIcon?: ImageSourcePropType;
}

export interface LockScreenMockupProps {
  wallpaper: ImageSourcePropType;
  time: string;
  date: string;
  notifications: NotificationPreview[];
  carrier?: string;
  battery?: number;
}

// iOS-style lockscreen approximation. Pixel-perfect enough that nobody clocks
// it in a thumbnail; readable enough that the notification body remains the
// thing your eye lands on. Drop your actual phone wallpaper in as a static
// require() and the framing reads as real.
export function LockScreenMockup({
  wallpaper,
  time,
  date,
  notifications,
  carrier = '',
  battery = 84,
}: LockScreenMockupProps) {
  return (
    <View style={styles.frame}>
      <ImageBackground source={wallpaper} style={styles.bg} resizeMode="cover">
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{carrier || ' '}</Text>
          <View style={styles.statusRight}>
            <Ionicons name="cellular" size={14} color="#fff" />
            <Ionicons name="wifi" size={14} color="#fff" style={styles.statusIcon} />
            <View style={styles.batteryRow}>
              <Text style={styles.batteryText}>{battery}</Text>
              <View style={styles.batteryShell}>
                <View style={[styles.batteryFill, { width: `${Math.min(100, Math.max(0, battery))}%` }]} />
              </View>
              <View style={styles.batteryNub} />
            </View>
          </View>
        </View>

        <View style={styles.clockBlock}>
          <View style={styles.lockRow}>
            <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.85)" />
          </View>
          <Text style={styles.date}>{date}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>

        <View style={styles.notificationsStack}>
          {notifications.map((n, i) => (
            <View key={i} style={styles.notification}>
              <View style={styles.appIcon}>
                {n.appIcon ? (
                  <ImageBackground source={n.appIcon} style={styles.appIconImg} imageStyle={styles.appIconImgInner} />
                ) : (
                  <Text style={styles.appIconLetter}>G</Text>
                )}
              </View>
              <View style={styles.notificationBody}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationApp}>{n.appName.toUpperCase()}</Text>
                  {n.timeAgo ? (
                    <Text style={styles.notificationTime}>{n.timeAgo}</Text>
                  ) : null}
                </View>
                <Text style={styles.notificationTitle}>{n.title}</Text>
                <Text style={styles.notificationText} numberOfLines={3}>
                  {n.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.homeIndicator} />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#000',
  },
  bg: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 18,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginLeft: 4,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  batteryText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.body,
    marginRight: 3,
  },
  batteryShell: {
    width: 22,
    height: 11,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    padding: 1,
  },
  batteryFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  batteryNub: {
    width: 2,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    marginLeft: 1,
  },
  clockBlock: {
    alignItems: 'center',
    marginTop: 18,
  },
  lockRow: {
    marginBottom: 8,
  },
  date: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.body,
    opacity: 0.9,
  },
  time: {
    color: '#fff',
    fontSize: 86,
    fontFamily: Fonts.heading,
    fontWeight: '300',
    marginTop: 2,
    letterSpacing: -2,
  },
  notificationsStack: {
    marginTop: 'auto',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 24,
  },
  notification: {
    flexDirection: 'row',
    backgroundColor: 'rgba(60,60,67,0.55)',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  appIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  appIconImg: {
    width: '100%',
    height: '100%',
  },
  appIconImgInner: {
    borderRadius: 9,
  },
  appIconLetter: {
    color: '#fff',
    fontSize: 22,
    fontFamily: Fonts.heading,
  },
  notificationBody: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notificationApp: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.3,
  },
  notificationTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: Fonts.body,
  },
  notificationTitle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    marginBottom: 2,
  },
  notificationText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 18,
  },
  homeIndicator: {
    alignSelf: 'center',
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});

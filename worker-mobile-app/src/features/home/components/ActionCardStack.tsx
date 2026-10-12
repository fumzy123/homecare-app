import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { cycleActionOrder, isUpwardCardDrag, reconcileActionOrder, shouldCycleCard } from '../lib/actionStack';
import { UrgentActionCard, type UrgentAction } from './UrgentActionCard';

/** Layer 2: local deck interaction only; never resolves or mutates action records. */
export function ActionCardStack({ actions, onInteractionChange }: {
  actions: UrgentAction[];
  onInteractionChange?: (active: boolean) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <MeasuredActionStack key={`${width}:${fontScale}`} actions={actions} onInteractionChange={onInteractionChange} />
  </View>;
}

function MeasuredActionStack({ actions, onInteractionChange }: {
  actions: UrgentAction[];
  onInteractionChange?: (active: boolean) => void;
}) {
  const [savedOrder, setOrder] = useState(() => actions.map(action => action.id));
  const order = reconcileActionOrder(savedOrder, actions.map(action => action.id));
  if (order.length !== savedOrder.length || order.some((id, index) => id !== savedOrder[index])) setOrder(order);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [reduceMotion, setReduceMotion] = useState(true);
  const signature = JSON.stringify(order);
  // Commit the new order with a fresh animation graph. Resetting the previous
  // native value after reordering can briefly hide the new front card.
  const progress = useMemo(() => new Animated.Value(0), [signature]);
  const busy = useRef(false);
  const mounted = useRef(true);
  const latest = useRef({ order, onInteractionChange });
  const height = Math.max(56, ...actions.map(action => heights[action.id] ?? 0));
  const multiple = order.length > 1;
  const topInset = multiple ? 16 : 0;

  useLayoutEffect(() => { latest.current = { order, onInteractionChange }; });
  useLayoutEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    busy.current = false;
    onInteractionChange?.(false);
  }, [signature, progress, onInteractionChange]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      progress.stopAnimation();
      latest.current.onInteractionChange?.(false);
    };
  }, [progress]);

  function settle() {
    Animated.spring(progress, { toValue: 0, useNativeDriver: true, tension: 180, friction: 24,
      ...(reduceMotion ? { overshootClamping: true } : {}) }).start(() => {
      busy.current = false;
      latest.current.onInteractionChange?.(false);
    });
  }
  function advance() {
    if (busy.current || !multiple) return;
    busy.current = true;
    const startedOrder = signature;
    Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : 190, useNativeDriver: true }).start(({ finished }) => {
      if (!mounted.current || !finished) return;
      // A refresh during a flick must not cycle a different card.
      if (JSON.stringify(latest.current.order) === startedOrder) setOrder(cycleActionOrder(latest.current.order));
      else settle();
    });
  }
  // Keep the responder instance alive across parent clock/scroll-state renders.
  const openTopCard = () => actions.find(action => action.id === order[0])?.onPress();
  const interaction = useRef({ multiple, reduceMotion, advance, settle, openTopCard, progress });
  useLayoutEffect(() => { interaction.current = { multiple, reduceMotion, advance, settle, openTopCard, progress }; });
  const [responder] = useState(() => PanResponder.create({
    // Claim touches on the deck before the enclosing native ScrollView starts
    // scrolling. Handle taps here too, since the child Pressable is bypassed.
    onStartShouldSetPanResponderCapture: () => interaction.current.multiple && !busy.current,
    onMoveShouldSetPanResponderCapture: (_, gesture) => interaction.current.multiple && !busy.current && gesture.numberActiveTouches === 1 && isUpwardCardDrag(gesture.dx, gesture.dy),
    onPanResponderGrant: () => { interaction.current.progress.stopAnimation(); latest.current.onInteractionChange?.(true); },
    onPanResponderMove: (_, gesture) => { interaction.current.progress.setValue(interaction.current.reduceMotion ? 0 : Math.min(0.85, Math.max(0, -gesture.dy / 110))); },
    onPanResponderRelease: (_, gesture) => {
      if (shouldCycleCard(gesture.dx, gesture.dy, gesture.vy)) interaction.current.advance();
      else {
        interaction.current.settle();
        if (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) interaction.current.openTopCard();
      }
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => interaction.current.settle(),
  }));
  const byId = new Map(actions.map(action => [action.id, action]));

  return <View>
    {/* Measure natural text height at full width, including large accessibility fonts.
        These copies never receive taps or appear in the accessibility tree. */}
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, opacity: 0 }}>
      {actions.map(action => <View key={action.id} style={{ position: 'absolute', left: 0, right: 0 }} onLayout={event => {
        const measured = Math.ceil(event.nativeEvent.layout.height);
        setHeights(previous => previous[action.id] === measured ? previous : { ...previous, [action.id]: measured });
      }}><UrgentActionCard action={action} disabled /></View>)}
    </View>
    <View key={signature} style={{ height: height + topInset, overflow: 'hidden' }}>
      {order.slice(0, 3).map((id, depth) => {
        const action = byId.get(id)!;
        const front = depth === 0;
        return <Animated.View key={id} pointerEvents={front ? 'auto' : 'none'}
          accessibilityElementsHidden={!front} importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
          {...(front ? responder.panHandlers : {})}
          style={{ position: 'absolute', top: topInset - depth * 8, left: 0, right: 0, zIndex: 3 - depth,
            opacity: front ? progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] }) : 1,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, front ? -Math.min(height * 0.65, 90) : 8] }) },
              { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [1 - depth * 0.035, front ? 0.97 : 1 - (depth - 1) * 0.035] }) },
            ] }}>
          <UrgentActionCard action={action} minHeight={height} disabled={!front}
            onPress={() => { if (!busy.current) action.onPress(); }} />
        </Animated.View>;
      })}
    </View>
    {multiple ? <View className="min-h-11 flex-row items-center justify-between gap-3">
      <Text accessibilityLiveRegion="polite" className="flex-1 font-sans text-xs text-ink-soft">
        {actions.findIndex(action => action.id === order[0]) + 1} of {actions.length} · Swipe up
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Show next action card" onPress={advance}
        className="min-h-11 justify-center px-2">
        <Text className="font-sans text-xs font-semibold text-orange">Next card ↑</Text>
      </Pressable>
    </View> : null}
  </View>;
}

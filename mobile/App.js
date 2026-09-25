import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { marketplace } from './src/marketplace';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';

const API = 'https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=500';
const SITE = 'https://perkdrop.au';
const PURPLE = '#a45cff';
const CATEGORIES = ['All', 'Food', 'Drinks', 'Events', 'Beauty', 'Experiences', 'Family', 'Free'];
const RAD = Math.PI / 180;
function distance(a, b, c, d) {
  if (![a, b, c, d].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const x = Math.sin((c - a) * RAD / 2) ** 2 + Math.cos(a * RAD) * Math.cos(c * RAD) * Math.sin((d - b) * RAD / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(x)));
}
const clean = value => String(value ?? '').trim();
const safeUrl = value => {
  if (!clean(value)) return null;
  try { const url = new URL(value, SITE); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};
function normalize(item) {
  return {
    id: clean(item.id || item.slug), merchantId: clean(item.merchantId || item.merchant_id), merchant: clean(item.merchant),
    title: clean(item.title), category: clean(item.category),
    description: clean(item.description), location: clean(item.location),
    city: clean(item.city), timing: clean(item.timing),
    conditions: clean(item.conditions), end: clean(item.end),
    image: safeUrl(item.imageUrl || item.image_url || item.image), imageCredit: item.imageCredit || null,
    price: clean(item.price), publicLabel: clean(item.publicLabel || item.public_label),
    merchantOfferId: clean(item.merchantOfferId || item.merchant_offer_id),
    redemptionAvailable: Boolean(item.redemptionAvailable || item.redemption_available),
    capacityRemaining: Number(item.capacityRemaining ?? item.capacity_remaining ?? 0),
    detail: safeUrl(item.detailUrl || item.detail_url || (item.slug && '/deals/' + encodeURIComponent(item.slug))),
    official: safeUrl(item.goUrl || item.go_url || item.officialSource || item.official_source),
    directions: safeUrl(item.navigationUrl || item.navigation_url),
    latitude: Number(item.latitude), longitude: Number(item.longitude)
  };
}
function groupListings(items) {
  const groups = new Map();
  for (const item of items) {
    const key = [item.merchant || item.id, item.location, item.city].map(x => x.toLowerCase()).join('|');
    if (!groups.has(key)) groups.set(key, { key, name: item.merchant || 'Local listing', location: item.location || item.city, offers: [] });
    groups.get(key).offers.push(item);
  }
  return [...groups.values()];
}
function categoryMatch(item, category) {
  if (category === 'All') return true;
  const text = (item.category + ' ' + item.title).toLowerCase();
  const terms = { Food: ['food', 'dining', 'restaurant', 'cafe'], Drinks: ['drink', 'bar'], Events: ['event', 'festival'], Beauty: ['beauty', 'hair', 'wellness'], Experiences: ['experience', 'activity', 'tour'], Family: ['family', 'kids'], Free: ['free'] };
  return terms[category].some(term => text.includes(term));
}
function OfferImage({ uri, title, detail = false, thumbnail = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const imageStyle = thumbnail ? styles.thumbnail : detail ? styles.detailImage : styles.image;
  if (!uri || failed) return <View style={[styles.imageFallback, imageStyle]}><Text style={styles.fallbackText}>PerkDrop</Text></View>;
  return <Image source={{ uri }} style={imageStyle} resizeMode="cover" accessibilityLabel={title || 'Place photo'} onError={() => setFailed(true)} />;
}
export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('Explore');
  const [saved, setSaved] = useState(new Set());
  const [point, setPoint] = useState(null);
  const [nearBusy, setNearBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passes, setPasses] = useState([]);
  const [activePass, setActivePass] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [claiming, setClaiming] = useState(false);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch(API, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error('Catalogue unavailable');
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload.deals;
      if (!Array.isArray(rows)) throw new Error('Invalid catalogue response');
      setItems(rows.map(normalize).filter(item => item.title && item.id));
      setError('');
    } catch {
      setError('Could not refresh listings. Pull down to try again.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  const loadSaved = useCallback(async () => {
    try {
      const data = await marketplace('my_perks');
      setSaved(new Set((data.saves || []).filter(x => x.kind === 'drop' && x.href).map(x => String(x.target))));
      setPasses(data.redemptions || []);
    } catch { setError('Saved offers could not be loaded. Pull down to retry.'); }
  }, []);
  useEffect(() => { load(); loadSaved(); }, [load, loadSaved]);
  useEffect(() => {
    if (tab !== 'Updates') return;
    marketplace('updates').then(data => setUpdates(data.updates || [])).catch(() => setError('Updates could not be loaded.'));
  }, [tab]);
  async function showPass(reference) {
    try {
      const result = await marketplace('pass', { reference });
      setActivePass(result.pass);
    } catch { setError('Could not load this pass. Please try again.'); }
  }
  function confirmClaim(item) {
    if (!item?.merchantOfferId || !item.redemptionAvailable || item.capacityRemaining < quantity || claiming) return;
    Alert.alert('Claim this Drop?', `Reserve ${quantity} ${quantity === 1 ? 'place' : 'places'} at ${item.merchant}. Check the conditions and service time before confirming.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Claim', onPress: async () => {
        setClaiming(true);
        try {
          const result = await marketplace('claim', { offer_id: item.merchantOfferId, quantity });
          const reference = result.redemption?.pass_reference;
          await loadSaved();
          await load(true);
          setSelected(null);
          if (reference) await showPass(reference);
        } catch (cause) { Alert.alert('Could not claim', cause?.message || 'Please check availability and try again.'); }
        finally { setClaiming(false); }
      } },
    ]);
  }
  async function useNearby() {
    setNearBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { setError('Location permission is off. You can still search all places.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPoint(position.coords);
      setError('');
    } catch { setError('Could not find your location. Try again or search by place.'); }
    finally { setNearBusy(false); }
  }
  async function toggleSaved(item) {
    if (!item || saving) return;
    setSaving(true);
    const remove = saved.has(item.id);
    try {
      await marketplace('save', { kind: 'drop', target: item.id, remove });
      setSaved(previous => { const next = new Set(previous); if (remove) next.delete(item.id); else next.add(item.id); return next; });
    } catch { setError('Could not update saved offers. Please try again.'); }
    finally { setSaving(false); }
  }
  const groups = useMemo(() => groupListings(items.filter(item => {
    if (tab === 'Saved' && !saved.has(item.id)) return false;
    if (point && distance(point.latitude, point.longitude, item.latitude, item.longitude) > 50) return false;
    const search = [item.title, item.merchant, item.location, item.city].join(' ').toLowerCase();
    return categoryMatch(item, category) && search.includes(query.trim().toLowerCase());
  }).sort((a, b) => point ? distance(point.latitude, point.longitude, a.latitude, a.longitude) - distance(point.latitude, point.longitude, b.latitude, b.longitude) : 0)), [items, category, query, saved, tab, point]);
  const open = url => { if (url) Linking.openURL(url).catch(() => setError('Could not open this link.')); };
  return <SafeAreaView style={styles.page}>
    <StatusBar barStyle="light-content" backgroundColor="#08090e" />
    <View style={styles.header}><View style={styles.brandRow}><Text style={styles.logo}>Perk<Text style={styles.logoAccent}>Drop</Text></Text><Pressable onPress={() => open(SITE + '/privacy')} accessibilityRole="link"><Text style={styles.privacyLink}>Privacy</Text></Pressable></View><Text style={styles.headline}>What’s worth doing near you?</Text></View>
    <View style={styles.toolbar}><Pressable onPress={() => point ? setPoint(null) : useNearby()} disabled={nearBusy} style={styles.nearButton} accessibilityRole="button"><Text style={styles.nearText}>{nearBusy ? 'Finding…' : point ? '✓ Near me' : '◎ Near me'}</Text></Pressable><Text style={styles.toolbarText}>{point ? 'Within 50 km · tap to clear' : 'Across Australia'}</Text></View>
    <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Search places and plans" placeholderTextColor="#888694" accessibilityLabel="Search listings" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories} contentContainerStyle={styles.categoryContent}>
      {CATEGORIES.map(name => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: category === name }} onPress={() => setCategory(name)} style={[styles.chip, category === name && styles.chipActive]}><Text style={[styles.chipText, category === name && styles.chipTextActive]}>{name}</Text></Pressable>)}
    </ScrollView>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {tab === 'Map' ? <WebView source={{ uri: SITE + '/map' }} style={styles.map} javaScriptEnabled geolocationEnabled
      onShouldStartLoadWithRequest={request => {
        if (request.url.startsWith(SITE + '/')) return true;
        open(safeUrl(request.url));
        return false;
      }} /> : tab === 'My perks' ? <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSaved} tintColor={PURPLE} />}>
      <Text style={styles.count}>Your claimed Drops</Text>
      {!passes.length ? <Text style={styles.empty}>Any Drops you claim in this app will appear here.</Text> : passes.map(pass => <Pressable key={pass.id} style={styles.passCard} onPress={() => showPass(pass.pass_reference)} accessibilityRole="button">
        <Text style={styles.offerCategory}>{pass.status}</Text><Text style={styles.offerTitle}>{pass.metadata?.offer_title || 'Your Drop'}</Text><Text style={styles.view}>View pass  →</Text>
      </Pressable>)}
    </ScrollView> : tab === 'Updates' ? <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.count}>Your updates</Text>
      {!updates.length ? <Text style={styles.empty}>No updates yet.</Text> : updates.map(update => <Pressable key={update.id} style={styles.passCard} accessibilityRole="button" onPress={() => {
        if (update.href) open(safeUrl(update.href));
        if (!update.read_at) marketplace('updates_read', { id: update.id }).then(() => setUpdates(previous => previous.map(row => row.id === update.id ? { ...row, read_at: new Date().toISOString() } : row))).catch(() => {});
      }}><Text style={styles.offerTitle}>{update.title}</Text><Text style={styles.body}>{update.body}</Text></Pressable>)}
    </ScrollView> : loading ? <ActivityIndicator style={styles.loader} size="large" color={PURPLE} /> :
      <FlatList data={groups} keyExtractor={group => group.key} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { load(true); loadSaved(); }} tintColor={PURPLE} />} contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.count}>{groups.length} {tab === 'Saved' ? 'saved places' : 'places to explore'}</Text>}
        ListEmptyComponent={<Text style={styles.empty}>{tab === 'Saved' ? 'Save an offer to find it here.' : 'No current listings match. Try another search or category.'}</Text>}
        renderItem={({ item: group }) => <View style={styles.card}>
          <OfferImage uri={group.offers[0].image} title={group.offers[0].title} />
          <View style={styles.cardBody}><Text style={styles.venue}>{group.name}</Text><Text style={styles.location}>{group.location}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.offerStrip}>
              {group.offers.map((offer, index) => <Pressable key={offer.id + '-' + index} onPress={() => { setQuantity(1); setSelected(offer); }} style={styles.offer} accessibilityRole="button">
                <OfferImage uri={offer.image} title={offer.title} thumbnail />
                <Text style={styles.offerCategory}>{offer.category || 'DROP'}</Text><Text numberOfLines={2} style={styles.offerTitle}>{offer.title}</Text><Text style={styles.view}>View details  →</Text>
              </Pressable>)}
            </ScrollView>
          </View>
        </View>} />}
    <View style={styles.tabs}>{['Explore', 'Map', 'Saved', 'My perks', 'Updates'].map(name => <Pressable key={name} onPress={() => setTab(name)} accessibilityRole="tab" accessibilityState={{ selected: tab === name }} style={styles.tab}><Text style={[styles.tabText, tab === name && styles.tabActive]}>{name}</Text></Pressable>)}</View>
    <Modal visible={!!activePass} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActivePass(null)}><SafeAreaView style={styles.modal}>
      <Pressable style={styles.close} onPress={() => setActivePass(null)}><Text style={styles.closeText}>Close</Text></Pressable>
      <ScrollView contentContainerStyle={styles.detailBody}><Text style={styles.offerCategory}>{activePass?.state || 'PASS'}</Text>
        <Text style={styles.detailTitle}>{activePass?.title}</Text><Text style={styles.venue}>{activePass?.merchant}</Text>
        <Text style={styles.body}>Reference: {activePass?.reference}</Text>
        {activePass?.code ? <Text selectable style={styles.passCode}>{activePass.code}</Text> : null}
        {activePass?.quantity ? <Text style={styles.body}>{activePass.quantity} {activePass.unit}{activePass.quantity === 1 ? '' : 's'}</Text> : null}
        {activePass?.service_start ? <Text style={styles.body}>Valid from: {activePass.service_start}</Text> : null}
        {activePass?.service_end ? <Text style={styles.body}>Valid until: {activePass.service_end}</Text> : null}
        {activePass?.location ? <Text style={styles.body}>{activePass.location}</Text> : null}
        {activePass?.terms ? <Text style={styles.conditions}>{activePass.terms}</Text> : null}
      </ScrollView>
    </SafeAreaView></Modal>
    <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={styles.modal}><Pressable style={styles.close} onPress={() => setSelected(null)}><Text style={styles.closeText}>Close</Text></Pressable>
        <ScrollView><OfferImage uri={selected?.image} title={selected?.title} detail />
          <View style={styles.detailBody}><Text style={styles.offerCategory}>{selected?.category}</Text><Text style={styles.detailTitle}>{selected?.title}</Text>
            <Text style={styles.venue}>{selected?.merchant}</Text><Text style={styles.location}>{selected?.location || selected?.city}</Text>
            {selected?.publicLabel ? <Text style={styles.badge}>{selected.publicLabel}</Text> : null}
            {selected?.price ? <Text style={styles.body}>{selected.price}</Text> : null}
            {selected?.timing ? <Text style={styles.body}>{selected.timing}</Text> : null}
            {selected?.description ? <Text style={styles.body}>{selected.description}</Text> : null}
            {selected?.conditions ? <Text style={styles.conditions}>Conditions: {selected.conditions}</Text> : null}
            {selected?.redemptionAvailable && selected.capacityRemaining > 0 && selected.merchantOfferId ? <View>
              <Text style={styles.body}>Available: {selected.capacityRemaining}</Text>
              <View style={styles.quantityRow}><Pressable onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.quantityButton}><Text style={styles.quantityText}>−</Text></Pressable><Text style={styles.quantityText}>{quantity}</Text><Pressable onPress={() => setQuantity(Math.min(6, selected.capacityRemaining, quantity + 1))} style={styles.quantityButton}><Text style={styles.quantityText}>+</Text></Pressable></View>
              <Pressable disabled={claiming} style={styles.primary} onPress={() => confirmClaim(selected)}><Text style={styles.primaryText}>{claiming ? 'Claiming…' : `Claim for ${quantity}`}</Text></Pressable>
            </View> : null}
            <Pressable style={styles.primary} onPress={() => open(selected?.detail)}><Text style={styles.primaryText}>View current details</Text></Pressable>
            <Pressable disabled={saving} style={styles.secondary} onPress={() => toggleSaved(selected)}><Text style={styles.secondaryText}>{saved.has(selected?.id) ? '♥ Saved — tap to remove' : '♡ Save this offer'}</Text></Pressable>
            {selected?.directions ? <Pressable style={styles.secondary} onPress={() => open(selected.directions)}><Text style={styles.secondaryText}>Get directions</Text></Pressable> : null}
            {selected?.official ? <Pressable style={styles.secondary} onPress={() => open(selected.official)}><Text style={styles.secondaryText}>Open official source</Text></Pressable> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#08090e' }, header: { paddingHorizontal: 20, paddingTop: 18 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15, gap: 12 },
  nearButton: { backgroundColor: '#29213d', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 }, nearText: { color: '#d6b8ff', fontSize: 14, fontWeight: '700' }, toolbarText: { color: '#aaa8b6', fontSize: 14 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2b2932', paddingBottom: 8 }, tab: { flex: 1, paddingVertical: 14, alignItems: 'center' }, tabText: { color: '#aaa8b6', fontSize: 13, fontWeight: '700' }, tabActive: { color: '#d6b8ff' },
  badge: { color: '#e8d4ff', fontSize: 14, fontWeight: '700', marginTop: 16 },
  passCard: { backgroundColor: '#191923', padding: 18, borderRadius: 16, marginBottom: 12 }, passCode: { color: '#fff', backgroundColor: '#29213d', fontSize: 28, fontWeight: '800', textAlign: 'center', padding: 18, marginTop: 20, borderRadius: 14 },
  map: { flex: 1, backgroundColor: '#08090e' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 16 }, quantityButton: { backgroundColor: '#29213d', borderRadius: 12, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, quantityText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  logo: { color: '#fff', fontSize: 27, fontWeight: '900' }, logoAccent: { color: PURPLE },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, privacyLink: { color: '#bcb6ca', fontSize: 14 },
  headline: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 20, marginBottom: 16 },
  search: { marginHorizontal: 20, backgroundColor: '#1b1b25', color: '#fff', borderRadius: 14, minHeight: 52, paddingHorizontal: 16, fontSize: 16 },
  categories: { flexGrow: 0, marginTop: 15 }, categoryContent: { paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  chip: { backgroundColor: '#1b1b25', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  chipActive: { backgroundColor: PURPLE }, chipText: { color: '#d5d3dc', fontSize: 15, fontWeight: '600' }, chipTextActive: { color: '#08090e' },
  count: { color: '#aaa8b6', fontSize: 14, marginBottom: 14 }, list: { padding: 20, paddingBottom: 55 },
  card: { backgroundColor: '#191923', borderRadius: 20, overflow: 'hidden', marginBottom: 19 },
  image: { height: 185, width: '100%' }, imageFallback: { height: 100, justifyContent: 'center', alignItems: 'center', backgroundColor: '#242134' }, fallbackText: { color: PURPLE, fontSize: 24, fontWeight: '800' },
  thumbnail: { height: 96, width: '100%', borderRadius: 9, marginBottom: 12 },
  cardBody: { padding: 16 }, venue: { color: '#fff', fontSize: 19, fontWeight: '800' }, location: { color: '#bbb9c6', fontSize: 14, marginTop: 3 },
  offerStrip: { marginTop: 15 }, offer: { backgroundColor: '#292634', borderRadius: 14, padding: 14, marginRight: 10, width: 220, minHeight: 120 },
  offerCategory: { color: '#c8a1ff', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  offerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 6 }, view: { color: '#d5b6ff', fontSize: 14, marginTop: 10 },
  error: { color: '#ffb3b3', marginHorizontal: 20, marginBottom: 4 }, empty: { color: '#bbb9c6', fontSize: 16, paddingTop: 40 },
  loader: { flex: 1 }, modal: { flex: 1, backgroundColor: '#08090e' }, close: { padding: 18, alignSelf: 'flex-end' },
  closeText: { color: '#d5b6ff', fontSize: 16 }, detailImage: { width: '100%', height: 245 }, detailBody: { padding: 22 },
  detailTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginVertical: 12 }, body: { color: '#e5e2ea', fontSize: 16, lineHeight: 24, marginTop: 20 },
  conditions: { color: '#bbb9c6', fontSize: 14, lineHeight: 21, marginTop: 20 }, primary: { backgroundColor: PURPLE, padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 28 },
  primaryText: { color: '#08090e', fontSize: 16, fontWeight: '800' }, secondary: { padding: 17, alignItems: 'center' }, secondaryText: { color: '#d5b6ff', fontSize: 15 }
});

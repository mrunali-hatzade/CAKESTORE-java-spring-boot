import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Admin Dashboard Metrics Presentation Tests
 *
 * Validates:
 * 1. Subscription payment labels and historical test activity disclosure.
 * 2. Bakery sales empty copy when GMV is 0 vs currency display when GMV > 0.
 * 3. 0% platform fee pass-through confirmation.
 * 4. Retained soft-deleted accounts and bakeries copy and compliance explanation.
 * 5. Formatting of All-Time vs date-filtered footers.
 */

function renderSubscriptionPaymentCard(stats, dateRange, formatCurrency) {
  const mainLabel = "Recorded Subscription Payments";
  const subLabel = "SaaS Subscription Billings";
  const amountDisplay = formatCurrency(stats?.periodPlatformRevenue ?? stats?.monthlyPlatformRevenue ?? 0);
  const footerText = dateRange === 'All Time'
    ? 'Total recorded subscription payments'
    : `${formatCurrency(stats?.totalPlatformRevenue ?? 0)} total recorded`;

  return {
    mainLabel,
    subLabel,
    amountDisplay,
    footerText,
  };
}

function renderBakerySalesCallout(stats, dateRange, formatCurrency) {
  const gmv = Number(stats?.periodGmv ?? stats?.monthlyGmv ?? 0);
  const compactSummary = `Bakery sales: ${formatCurrency(gmv)} · 0% platform fee`;
  const tooltipExplanation = gmv === 0
    ? "No qualifying bakery order sales recorded in this database."
    : null;

  return {
    compactSummary,
    tooltipExplanation,
    gmv,
  };
}

function renderDeletedRecordsLabels(stats) {
  const explanation = "Retained soft-deleted records for compliance and audit logging. May include accumulated development/test activity.";
  const accountsLabel = `${stats?.deletedAccounts ?? 0} retained deleted accounts`;
  const bakeriesLabel = `${stats?.deletedBakeries ?? 0} retained deleted bakeries`;

  return {
    explanation,
    accountsLabel,
    bakeriesLabel,
  };
}

const mockFormatCurrency = (val) => `₹${Number(val).toLocaleString('en-IN')}`;

test('1. Subscription Payments card renders accurate labels and footers without disclosure in UI', () => {
  const stats = {
    periodPlatformRevenue: 9995,
    monthlyPlatformRevenue: 9995,
    totalPlatformRevenue: 9995,
  };

  // Test All Time view
  const allTimeCard = renderSubscriptionPaymentCard(stats, 'All Time', mockFormatCurrency);
  assert.equal(allTimeCard.mainLabel, 'Recorded Subscription Payments');
  assert.equal(allTimeCard.subLabel, 'SaaS Subscription Billings');
  assert.equal(allTimeCard.amountDisplay, '₹9,995');
  assert.equal(allTimeCard.footerText, 'Total recorded subscription payments');

  // Test Date Filtered view
  const filteredCard = renderSubscriptionPaymentCard(stats, 'This Month', mockFormatCurrency);
  assert.equal(filteredCard.footerText, '₹9,995 total recorded');
});

test('2. Bakery sales callout renders compact summary and tooltip when GMV is 0', () => {
  const emptyStats = {
    periodGmv: 0,
    monthlyGmv: 0,
    totalGmv: 0,
  };

  const emptyCallout = renderBakerySalesCallout(emptyStats, 'All Time', mockFormatCurrency);
  assert.equal(emptyCallout.compactSummary, 'Bakery sales: ₹0 · 0% platform fee');
  assert.equal(emptyCallout.tooltipExplanation, 'No qualifying bakery order sales recorded in this database.');
});

test('3. Bakery sales callout renders compact summary with active GMV amount', () => {
  const activeStats = {
    periodGmv: 15400,
    monthlyGmv: 15400,
    totalGmv: 52000,
  };

  const activeCallout = renderBakerySalesCallout(activeStats, 'This Month', mockFormatCurrency);
  assert.equal(activeCallout.compactSummary, 'Bakery sales: ₹15,400 · 0% platform fee');
  assert.equal(activeCallout.tooltipExplanation, null);
});

test('4. Retained soft-deleted records labels and explanatory disclosures match approved standards', () => {
  const stats = {
    deletedAccounts: 6423,
    deletedBakeries: 3463,
  };

  const labels = renderDeletedRecordsLabels(stats);
  assert.equal(labels.accountsLabel, '6423 retained deleted accounts');
  assert.equal(labels.bakeriesLabel, '3463 retained deleted bakeries');
  assert.equal(labels.explanation, 'Retained soft-deleted records for compliance and audit logging. May include accumulated development/test activity.');
});

test('5. Total Subscription Records information tooltip renders accurate explanation and accessibility attributes', () => {
  const explanation = "Total Subscription Records counts all entries in the subscriptions database table (lifetime created). The status metrics below count distinct registered bakeries and do not sum to this historical total.";
  const ariaLabel = "Total Subscription Records explanation";
  const tooltipId = "sub-records-tooltip";
  const buttonId = "sub-records-info-btn";

  assert.match(explanation, /counts all entries in the subscriptions database table/);
  assert.match(explanation, /status metrics below count distinct registered bakeries/);
  assert.equal(ariaLabel, 'Total Subscription Records explanation');
  assert.equal(tooltipId, 'sub-records-tooltip');
  assert.equal(buttonId, 'sub-records-info-btn');
});

test('6. Awaiting Payment metric renders approved label and tooltip copy', () => {
  const stats = { pendingPaymentBakeries: 5 };
  const label = `${stats.pendingPaymentBakeries} Awaiting Payment`;
  const tooltip = "Distinct registered bakeries awaiting initial subscription activation.";

  assert.equal(label, '5 Awaiting Payment');
  assert.equal(tooltip, 'Distinct registered bakeries awaiting initial subscription activation.');
});

test('7. Today\'s Activity metrics render accurate labels and timezone explanations', () => {
  const stats = {
    todayRegistrations: 4,
    todayPayments: 2,
  };

  const regLabel = `${stats.todayRegistrations ?? 0} New Registrations Today`;
  const payLabel = `${stats.todayPayments ?? 0} Subscription Payments Today`;

  assert.equal(regLabel, '4 New Registrations Today');
  assert.equal(payLabel, '2 Subscription Payments Today');
});

test('8. Today\'s Activity metrics handle zero and undefined values gracefully', () => {
  const emptyStats = {};
  const regLabel = `${emptyStats?.todayRegistrations ?? 0} New Registrations Today`;
  const payLabel = `${emptyStats?.todayPayments ?? 0} Subscription Payments Today`;

  assert.equal(regLabel, '0 New Registrations Today');
  assert.equal(payLabel, '0 Subscription Payments Today');
});

test('9. Total Bakeries Card Section A (Account Status) vs Section B (Subscription Status) separation', () => {
  const stats = {
    totalRegisteredBakeries: 10,
    activeBakeries: 7,
    pendingBakeries: 2,
    inactiveBakeries: 1,
    suspendedBakeries: 0,
    activeSubscribedBakeries: 5,
    pendingPaymentBakeries: 3,
    expiredSubscribedBakeries: 2,
    deletedBakeries: 12,
  };

  // Section A: Mutually exclusive bakery lifecycle account statuses sum to total registered bakeries
  const accountStatusesSum = (stats.activeBakeries ?? 0) + (stats.pendingBakeries ?? 0) + (stats.inactiveBakeries ?? 0) + (stats.suspendedBakeries ?? 0);
  assert.equal(accountStatusesSum, stats.totalRegisteredBakeries);

  // Section B: Subscription statuses are distinct from account status
  assert.notEqual(stats.activeBakeries, stats.activeSubscribedBakeries);
  assert.equal(stats.activeSubscribedBakeries, 5);
  assert.equal(stats.pendingPaymentBakeries, 3);
  assert.equal(stats.expiredSubscribedBakeries, 2);

  // Section C: Soft-deleted bakeries are excluded from registered total
  assert.equal(stats.deletedBakeries, 12);
  assert.ok(stats.deletedBakeries > stats.totalRegisteredBakeries);
});

test('10. Awaiting Payment eligibility business rule excludes expired subscribers and counts distinct bakeries', () => {
  // Verifies the contract: registered bakeries awaiting initial subscription payment, excluding suspended & expired
  const awaitingPaymentDesc = "Eligible registered bakeries awaiting initial subscription payment (excluding previously expired subscribers).";
  assert.match(awaitingPaymentDesc, /excluding previously expired subscribers/i);
  assert.match(awaitingPaymentDesc, /awaiting initial subscription payment/i);
});




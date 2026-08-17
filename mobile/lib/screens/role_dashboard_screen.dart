import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/auth_provider.dart';
import '../widgets/medtrace_logo.dart';

/// ---------------------------------------------------------------------
/// Colors
/// ---------------------------------------------------------------------
class _C {
  static const primary = Color(0xFF2563EB);
  static const teal = Color(0xFF14B8A6);
  static const green = Color(0xFF16A34A);
  static const amber = Color(0xFFF59E0B);
  static const red = Color(0xFFDC2626);
  static const ink = Color(0xFF0F172A);
  static const subtext = Color(0xFF64748B);
  static const faint = Color(0xFF94A3B8);
  static const border = Color(0xFFE2E8F0);
  static const bg = Color(0xFFF8FAFC);
}

/// ---------------------------------------------------------------------
/// Data Models
/// ---------------------------------------------------------------------
enum HealthStatus { stable, attention, critical }

class VitalSignData {
  final String label;
  final String value;
  final String status;
  final IconData icon;
  const VitalSignData({
    required this.label,
    required this.value,
    required this.status,
    required this.icon,
  });
}

class AlertData {
  final String title;
  final String timeAgo;
  final bool isCritical;
  const AlertData({required this.title, required this.timeAgo, required this.isCritical});
}

class ReportSummary {
  final String title;
  final String date;
  final String statusLabel;
  final Color statusColor;
  const ReportSummary({
    required this.title,
    required this.date,
    required this.statusLabel,
    required this.statusColor,
  });
}

class PatientSummary {
  final String id;
  final String name;
  final HealthStatus status;
  final String lastUpdated;
  final List<VitalSignData> vitals;
  final int respiratoryRate;
  final String breathingPattern;
  final bool respiratoryAnomaly;
  final String respiratoryLastUpdated;
  final List<AlertData> alerts;
  final String aiSummary;
  final List<ReportSummary> reports;
  final List<int> spo2Trend;
  final List<int> respiratoryTrend;
  final List<String> recommendations;

  const PatientSummary({
    required this.id,
    required this.name,
    required this.status,
    required this.lastUpdated,
    required this.vitals,
    required this.respiratoryRate,
    required this.breathingPattern,
    required this.respiratoryAnomaly,
    required this.respiratoryLastUpdated,
    required this.alerts,
    required this.aiSummary,
    required this.reports,
    required this.spo2Trend,
    required this.respiratoryTrend,
    required this.recommendations,
  });
}

final List<PatientSummary> _mockPatients = [
  PatientSummary(
    id: 'p1',
    name: 'Rahul',
    status: HealthStatus.stable,
    lastUpdated: '5 minutes ago',
    vitals: const [
      VitalSignData(label: 'Heart Rate', value: '78 BPM', status: 'Normal', icon: Icons.favorite),
      VitalSignData(label: 'SpO₂', value: '98%', status: 'Normal', icon: Icons.water_drop),
      VitalSignData(label: 'Respiratory Rate', value: '16 BPM', status: 'Normal', icon: Icons.air),
      VitalSignData(label: 'Temperature', value: '98.2°F', status: 'Normal', icon: Icons.thermostat),
    ],
    respiratoryRate: 16,
    breathingPattern: 'Normal',
    respiratoryAnomaly: false,
    respiratoryLastUpdated: '2 min ago',
    alerts: const [],
    aiSummary:
        'Your latest health information appears stable. Your respiratory rate and oxygen saturation are currently within the monitored range.',
    reports: const [
      ReportSummary(title: 'Blood Test', date: '28 July 2026', statusLabel: 'Analysis completed', statusColor: _C.green),
      ReportSummary(title: 'Chest X-Ray', date: '20 July 2026', statusLabel: 'Review recommended', statusColor: _C.amber),
    ],
    spo2Trend: const [96, 97, 98, 98],
    respiratoryTrend: const [18, 17, 16, 16],
    recommendations: const ['Follow the monitoring instructions provided by your healthcare team.'],
  ),
];

/// ---------------------------------------------------------------------
/// Main Screen Component
/// ---------------------------------------------------------------------
class RoleDashboardScreen extends StatefulWidget {
  final String roleName;

  const RoleDashboardScreen({Key? key, required this.roleName}) : super(key: key);

  @override
  State<RoleDashboardScreen> createState() => _RoleDashboardScreenState();
}

class _RoleDashboardScreenState extends State<RoleDashboardScreen> {
  int _navIndex = 0;
  late PatientSummary _selectedPatient;
  String _alertFilter = 'All';

  bool get _isGuardian => widget.roleName.toLowerCase() == 'guardian';

  @override
  void initState() {
    super.initState();
    _selectedPatient = _mockPatients.first;
  }

  String _getGreetingName(AuthProvider auth) {
    return auth.currentUser?.name ?? (_isGuardian ? 'Guardian' : 'Patient');
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    final tabs = <Widget>[
      _buildHomeTab(context, auth),
      _buildReportsTab(context),
      _buildHealthTab(context),
      _buildAiTab(context),
      _buildProfileTab(context, auth),
    ];

    return Scaffold(
      backgroundColor: _C.bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        automaticallyImplyLeading: false,
        title: const MedTraceLogoWidget(size: 28, showText: true),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none, color: _C.ink),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent),
            onPressed: () async {
              await auth.logout();
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        child: IndexedStack(index: _navIndex, children: tabs),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _navIndex,
        onTap: (i) => setState(() => _navIndex = i),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: _C.primary,
        unselectedItemColor: _C.faint,
        showUnselectedLabels: true,
        selectedLabelStyle: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700),
        unselectedLabelStyle: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.description_outlined), activeIcon: Icon(Icons.description), label: 'Reports'),
          BottomNavigationBarItem(icon: Icon(Icons.favorite_outline), activeIcon: Icon(Icons.favorite), label: 'Health'),
          BottomNavigationBarItem(icon: Icon(Icons.smart_toy_outlined), activeIcon: Icon(Icons.smart_toy), label: 'AI'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
      floatingActionButton: _navIndex == 0
          ? FloatingActionButton.extended(
              backgroundColor: _C.primary,
              onPressed: () => setState(() => _navIndex = 3),
              icon: const Icon(Icons.smart_toy_outlined, color: Colors.white),
              label: Text('MedTrace AI', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w700)),
            )
          : null,
    );
  }

  // ---------------------------------------------------------------------
  // HOME TAB
  // ---------------------------------------------------------------------
  Widget _buildHomeTab(BuildContext context, AuthProvider auth) {
    final p = _selectedPatient;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      children: [
        _buildGreetingHeader(p, auth),
        const SizedBox(height: 20),
        _buildStatusCard(p),
        const SizedBox(height: 20),
        _sectionTitle('Vital Signs'),
        const SizedBox(height: 10),
        _buildVitalsRow(p),
        const SizedBox(height: 20),
        _buildRespiratoryCard(p),
        const SizedBox(height: 20),
        _sectionTitle('Recent Alerts'),
        const SizedBox(height: 10),
        _buildAlertFilters(),
        const SizedBox(height: 10),
        _buildAlertsSection(p),
        const SizedBox(height: 20),
        _buildAiSummaryCard(p),
        const SizedBox(height: 20),
        _buildReportsSection(p, compact: true),
        const SizedBox(height: 20),
        _buildTrendSection(p),
        const SizedBox(height: 20),
        _buildRecommendationsSection(p),
      ],
    );
  }

  Widget _buildGreetingHeader(PatientSummary p, AuthProvider auth) {
    final greeting = 'Good morning, ${_getGreetingName(auth)} 👋';
    final subtitle = _isGuardian ? "${p.name}'s Health Overview" : 'Here\'s your latest health information';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(greeting, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: _C.ink)),
        const SizedBox(height: 4),
        Text(subtitle, style: GoogleFonts.inter(fontSize: 14, color: _C.subtext)),
        if (_isGuardian) ...[
          const SizedBox(height: 10),
          _buildPatientSwitcher(),
        ],
      ],
    );
  }

  Widget _buildPatientSwitcher() {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () async {
        final chosen = await showModalBottomSheet<PatientSummary>(
          context: context,
          builder: (ctx) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: _mockPatients
                  .map((pt) => ListTile(
                        title: Text(pt.name, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                        trailing: pt.id == _selectedPatient.id ? const Icon(Icons.check, color: _C.primary) : null,
                        onTap: () => Navigator.pop(ctx, pt),
                      ))
                  .toList(),
            ),
          ),
        );
        if (chosen != null) setState(() => _selectedPatient = chosen);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _C.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Viewing: ${_selectedPatient.name}',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: _C.ink)),
            const SizedBox(width: 4),
            const Icon(Icons.expand_more, size: 18, color: _C.subtext),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard(PatientSummary p) {
    final isStable = p.status == HealthStatus.stable;
    final isAttention = p.status == HealthStatus.attention;
    final color = isStable ? _C.green : (isAttention ? _C.amber : _C.red);
    final label = isStable ? 'STABLE' : (isAttention ? 'ATTENTION' : 'CRITICAL');
    final message = isStable
        ? 'No critical abnormalities have been detected in the latest available monitoring data.'
        : isAttention
            ? 'Some readings are outside the normal range. Please review the details below.'
            : 'Urgent readings detected. Please contact the healthcare team immediately.';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _C.border),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.10), blurRadius: 24, offset: const Offset(0, 10)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(label, style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w800, color: _C.ink)),
            ],
          ),
          const SizedBox(height: 10),
          Text(message, style: GoogleFonts.inter(fontSize: 13, color: _C.subtext, height: 1.5)),
          const SizedBox(height: 14),
          Text('Updated ${p.lastUpdated}', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: _C.faint)),
        ],
      ),
    );
  }

  Widget _buildVitalsRow(PatientSummary p) {
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: p.vitals.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final v = p.vitals[i];
          return Container(
            width: 130,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _C.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(v.icon, size: 20, color: _C.primary),
                const Spacer(),
                Text(v.value, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: _C.ink)),
                Text(v.label, style: GoogleFonts.inter(fontSize: 11, color: _C.subtext)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildRespiratoryCard(PatientSummary p) {
    final anomaly = p.respiratoryAnomaly;
    final color = anomaly ? _C.red : _C.green;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: anomaly ? _C.red.withValues(alpha: 0.4) : _C.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.air, color: _C.primary),
              const SizedBox(width: 8),
              Text('Respiratory Monitoring', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: _C.ink)),
            ],
          ),
          const SizedBox(height: 14),
          if (anomaly) ...[
            Row(
              children: [
                const Icon(Icons.error_outline, color: _C.red, size: 20),
                const SizedBox(width: 6),
                Text('Breathing Anomaly Detected',
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: _C.red)),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'An unusual breathing pattern has been detected. This is an automated observation, not a confirmed diagnosis — please contact the healthcare team.',
              style: GoogleFonts.inter(fontSize: 12.5, color: _C.subtext, height: 1.5),
            ),
          ] else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${p.respiratoryRate} BPM', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: _C.ink)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                  child: Text('Normal', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('Breathing Pattern: ${p.breathingPattern}', style: GoogleFonts.inter(fontSize: 12.5, color: _C.subtext)),
            Text('Monitoring: Active', style: GoogleFonts.inter(fontSize: 12.5, color: _C.subtext)),
            Text('Last updated: ${p.respiratoryLastUpdated}', style: GoogleFonts.inter(fontSize: 12.5, color: _C.subtext)),
          ],
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() => _navIndex = 2),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(anomaly ? 'View Details' : 'View Monitoring',
                      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: _C.primary)),
                  const SizedBox(width: 4),
                  const Icon(Icons.arrow_forward, size: 14, color: _C.primary),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAlertFilters() {
    const filters = ['All', 'Critical', 'Warning', 'Resolved'];
    return SizedBox(
      height: 32,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final f = filters[i];
          final selected = f == _alertFilter;
          return ChoiceChip(
            label: Text(f, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600)),
            selected: selected,
            selectedColor: _C.primary.withValues(alpha: 0.12),
            labelStyle: TextStyle(color: selected ? _C.primary : _C.subtext),
            backgroundColor: Colors.white,
            side: const BorderSide(color: _C.border),
            onSelected: (_) => setState(() => _alertFilter = f),
          );
        },
      ),
    );
  }

  Widget _buildAlertsSection(PatientSummary p) {
    if (p.alerts.isEmpty) {
      return _softCard(
        child: Row(
          children: [
            const Icon(Icons.check_circle, color: _C.green, size: 20),
            const SizedBox(width: 8),
            Text('No critical alerts', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: _C.ink)),
          ],
        ),
      );
    }

    return Column(
      children: p.alerts.map((a) {
        final color = a.isCritical ? _C.red : _C.amber;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: color, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(a.title, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: _C.ink)),
                    Text(a.timeAgo, style: GoogleFonts.inter(fontSize: 11.5, color: _C.subtext)),
                  ],
                ),
              ),
              Text('View Alert', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: _C.primary)),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildAiSummaryCard(PatientSummary p) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [_C.primary.withValues(alpha: 0.06), _C.teal.withValues(alpha: 0.06)]),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _C.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.smart_toy_outlined, color: _C.primary),
              const SizedBox(width: 8),
              Text('AI Health Summary', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: _C.ink)),
            ],
          ),
          const SizedBox(height: 10),
          Text('"${p.aiSummary}"', style: GoogleFonts.inter(fontSize: 13, color: _C.subtext, height: 1.5, fontStyle: FontStyle.italic)),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => setState(() => _navIndex = 3),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: _C.primary),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              child: Text('Ask MedTrace AI', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: _C.primary)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReportsSection(PatientSummary p, {bool compact = false}) {
    final items = compact ? p.reports.take(2).toList() : p.reports;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Recent Reports'),
        const SizedBox(height: 10),
        ...items.map((r) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _C.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: r.statusColor, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(r.title, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: _C.ink)),
                        Text(r.date, style: GoogleFonts.inter(fontSize: 11.5, color: _C.subtext)),
                      ],
                    ),
                  ),
                  Text(r.statusLabel, style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w600, color: r.statusColor)),
                  const SizedBox(width: 6),
                  const Icon(Icons.chevron_right, size: 18, color: _C.faint),
                ],
              ),
            )),
        if (compact)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() => _navIndex = 1),
              child: Text('View All Reports →', style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w700, color: _C.primary)),
            ),
          ),
      ],
    );
  }

  Widget _buildTrendSection(PatientSummary p) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Health Trend'),
        const SizedBox(height: 10),
        _softCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _trendRow('SpO₂', p.spo2Trend, 'Stable', _C.green),
              const Divider(height: 24, color: _C.border),
              _trendRow('Respiratory Rate', p.respiratoryTrend, 'Improving', _C.green),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => setState(() => _navIndex = 2),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: _C.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text('View Health History', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: _C.ink)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _trendRow(String label, List<int> values, String status, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w700, color: _C.ink)),
        const SizedBox(height: 6),
        Row(
          children: [
            Text(values.join(' → '), style: GoogleFonts.inter(fontSize: 13, color: _C.subtext)),
            const Spacer(),
            Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(status, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ],
    );
  }

  Widget _buildRecommendationsSection(PatientSummary p) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle("Doctor's Recommendations"),
        const SizedBox(height: 10),
        _softCard(
          child: p.recommendations.isEmpty
              ? Text('No new recommendations available.', style: GoogleFonts.inter(fontSize: 13, color: _C.subtext))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: p.recommendations
                      .map((r) => Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.check_circle_outline, size: 16, color: _C.teal),
                                const SizedBox(width: 8),
                                Expanded(child: Text(r, style: GoogleFonts.inter(fontSize: 13, color: _C.subtext, height: 1.4))),
                              ],
                            ),
                          ))
                      .toList(),
                ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // REPORTS TAB
  // ---------------------------------------------------------------------
  Widget _buildReportsTab(BuildContext context) {
    final p = _selectedPatient;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      children: [
        Text('Medical Reports', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: _C.ink)),
        const SizedBox(height: 4),
        Text(
          _isGuardian ? 'Reports permitted by the hospital for ${p.name}.' : 'Original reports, AI summaries and doctor notes.',
          style: GoogleFonts.inter(fontSize: 13, color: _C.subtext),
        ),
        const SizedBox(height: 16),
        _buildReportsSection(p),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // HEALTH TAB
  // ---------------------------------------------------------------------
  Widget _buildHealthTab(BuildContext context) {
    final p = _selectedPatient;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      children: [
        Text('Health History', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: _C.ink)),
        const SizedBox(height: 4),
        Text('Trends, monitoring status and full vitals timeline.', style: GoogleFonts.inter(fontSize: 13, color: _C.subtext)),
        const SizedBox(height: 16),
        _buildRespiratoryCard(p),
        const SizedBox(height: 20),
        _buildTrendSection(p),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // AI TAB
  // ---------------------------------------------------------------------
  Widget _buildAiTab(BuildContext context) {
    final suggestions = [
      'Explain my latest report.',
      'What does SpO₂ mean?',
      'Show my recent health changes.',
      'Explain this medical term.',
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('MedTrace AI', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: _C.ink)),
          const SizedBox(height: 4),
          Text(
            'Answers are based only on data you\'re authorized to view.',
            style: GoogleFonts.inter(fontSize: 13, color: _C.subtext),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: suggestions
                .map((s) => ActionChip(
                      label: Text(s, style: GoogleFonts.inter(fontSize: 12.5)),
                      backgroundColor: Colors.white,
                      side: const BorderSide(color: _C.border),
                      onPressed: () {},
                    ))
                .toList(),
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: _C.border),
            ),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Ask about your health…',
                hintStyle: GoogleFonts.inter(fontSize: 13, color: _C.faint),
                border: InputBorder.none,
                suffixIcon: const Icon(Icons.send, color: _C.primary, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // PROFILE TAB
  // ---------------------------------------------------------------------
  Widget _buildProfileTab(BuildContext context, AuthProvider auth) {
    final user = auth.currentUser;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      children: [
        Text('Profile', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: _C.ink)),
        const SizedBox(height: 16),
        _softCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(user?.name ?? (_isGuardian ? 'Guardian' : 'Patient'),
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: _C.ink)),
              const SizedBox(height: 4),
              Text((user?.role ?? widget.roleName).toUpperCase(),
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: _C.primary)),
              const Divider(height: 24, color: _C.border),
              Text(user?.hospitalName ?? 'MedTrace General Hospital', style: GoogleFonts.inter(fontSize: 13, color: _C.subtext)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.privacy_tip_outlined, color: _C.ink),
          title: Text('Permissions & Access', style: GoogleFonts.inter(fontSize: 13.5, fontWeight: FontWeight.w600)),
          trailing: const Icon(Icons.chevron_right, size: 18, color: _C.faint),
          onTap: () {},
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.settings_outlined, color: _C.ink),
          title: Text('Settings', style: GoogleFonts.inter(fontSize: 13.5, fontWeight: FontWeight.w600)),
          trailing: const Icon(Icons.chevron_right, size: 18, color: _C.faint),
          onTap: () {},
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Shared small pieces
  // ---------------------------------------------------------------------
  Widget _sectionTitle(String text) =>
      Text(text, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w800, color: _C.ink));

  Widget _softCard({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _C.border),
      ),
      child: child,
    );
  }
}

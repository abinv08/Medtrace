import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class CaretakerDashboardScreen extends StatefulWidget {
  const CaretakerDashboardScreen({super.key});

  @override
  State<CaretakerDashboardScreen> createState() => _CaretakerDashboardScreenState();
}

class _CaretakerDashboardScreenState extends State<CaretakerDashboardScreen> {
  late Future<List<_MonitoredPatient>> _patientsFuture;

  @override
  void initState() {
    super.initState();
    _patientsFuture = _loadPatients();
  }

  Future<List<_MonitoredPatient>> _loadPatients() async {
    final auth = context.read<AuthProvider>();
    final caretakerId = auth.currentUser?.id;
    if (caretakerId == null || caretakerId.isEmpty) throw const ApiException(400, 'Caretaker profile is not available');
    final api = ApiService(authProvider: auth);
    final patients = await api.fetchCaretakerPatients(caretakerId);
    return Future.wait(patients.map((patient) async {
      final id = _idOf(patient);
      final vitals = id == null ? null : await api.fetchLatestVitals(id);
      return _MonitoredPatient(patient: patient, vitals: vitals);
    }));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Caretaker dashboard'),
        actions: [IconButton(onPressed: () => setState(() => _patientsFuture = _loadPatients()), icon: const Icon(Icons.refresh))],
      ),
      body: FutureBuilder<List<_MonitoredPatient>>(
        future: _patientsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return _ErrorState(message: snapshot.error.toString(), onRetry: () => setState(() => _patientsFuture = _loadPatients()));
          final patients = snapshot.data ?? [];
          if (patients.isEmpty) return const Center(child: Text('No monitored patients.'));
          final alerts = patients.where((patient) => patient.hasAlert).length;
          return RefreshIndicator(
            onRefresh: () async => setState(() => _patientsFuture = _loadPatients()),
            child: ListView(padding: const EdgeInsets.all(16), children: [
              _AlertBanner(count: alerts),
              const SizedBox(height: 16),
              Text('Monitored patients', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              ...patients.map((patient) => _PatientCard(monitoredPatient: patient)),
            ]),
          );
        },
      ),
    );
  }
}

class _MonitoredPatient {
  final Map<String, dynamic> patient;
  final Map<String, dynamic>? vitals;
  const _MonitoredPatient({required this.patient, required this.vitals});

  bool get hasAlert {
    final spo2 = num.tryParse('${vitals?['spo2']}');
    final heartRate = num.tryParse('${vitals?['heartRate']}');
    return vitals == null || (spo2 != null && spo2 < 92) || (heartRate != null && (heartRate < 50 || heartRate > 120));
  }

  String get alertText {
    if (vitals == null) return 'No recent vitals available';
    final spo2 = num.tryParse('${vitals?['spo2']}');
    if (spo2 != null && spo2 < 92) return 'Low oxygen saturation';
    final heartRate = num.tryParse('${vitals?['heartRate']}');
    if (heartRate != null && (heartRate < 50 || heartRate > 120)) return 'Heart rate needs attention';
    return 'Vitals stable';
  }
}

class _AlertBanner extends StatelessWidget {
  final int count;
  const _AlertBanner({required this.count});
  @override
  Widget build(BuildContext context) => Card(
        color: count > 0 ? Colors.orange.shade50 : Colors.green.shade50,
        child: ListTile(
          leading: Icon(count > 0 ? Icons.warning_amber_rounded : Icons.check_circle_outline, color: count > 0 ? Colors.orange : Colors.green),
          title: Text(count > 0 ? '$count active alert${count == 1 ? '' : 's'}' : 'No active alerts'),
          subtitle: Text(count > 0 ? 'Review the highlighted patients below.' : 'All monitored patients have stable readings.'),
        ),
      );
}

class _PatientCard extends StatelessWidget {
  final _MonitoredPatient monitoredPatient;
  const _PatientCard({required this.monitoredPatient});
  @override
  Widget build(BuildContext context) {
    final patient = monitoredPatient.patient;
    final user = patient['userId'] is Map ? patient['userId'] as Map : const {};
    final alert = monitoredPatient.hasAlert;
    return Card(
      child: ListTile(
        leading: CircleAvatar(backgroundColor: alert ? Colors.orange : AppColors.secondary, child: Icon(alert ? Icons.warning_amber : Icons.person, color: Colors.white)),
        title: Text('${user['name'] ?? patient['name'] ?? 'Patient'}'),
        subtitle: Text('${monitoredPatient.alertText}\n${_vitalsSummary(monitoredPatient.vitals)}'),
        isThreeLine: true,
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(message, textAlign: TextAlign.center), const SizedBox(height: 12), ElevatedButton(onPressed: onRetry, child: const Text('Try again'))]));
}

String? _idOf(Map<String, dynamic> value) => (value['_id'] ?? value['id'])?.toString();

String _vitalsSummary(Map<String, dynamic>? vitals) => vitals == null ? 'No recent vitals' : 'HR ${vitals['heartRate'] ?? '--'} BPM  |  SpO2 ${vitals['spo2'] ?? '--'}%';

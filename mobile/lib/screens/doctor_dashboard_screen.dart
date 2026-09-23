import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class DoctorDashboardScreen extends StatefulWidget {
  const DoctorDashboardScreen({super.key});

  @override
  State<DoctorDashboardScreen> createState() => _DoctorDashboardScreenState();
}

class _DoctorDashboardScreenState extends State<DoctorDashboardScreen> {
  late Future<List<Map<String, dynamic>>> _patientsFuture;

  @override
  void initState() {
    super.initState();
    _patientsFuture = _loadPatients();
  }

  Future<List<Map<String, dynamic>>> _loadPatients() {
    final auth = context.read<AuthProvider>();
    final doctorId = auth.currentUser?.id;
    if (doctorId == null || doctorId.isEmpty) {
      return Future.error(const ApiException(400, 'Doctor profile is not available'));
    }
    return ApiService(authProvider: auth).fetchPatientsByDoctor(doctorId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Doctor dashboard'),
        actions: [
          IconButton(onPressed: () => setState(() => _patientsFuture = _loadPatients()), icon: const Icon(Icons.refresh)),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _patientsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return _ErrorState(message: snapshot.error.toString(), onRetry: () => setState(() => _patientsFuture = _loadPatients()));
          final patients = snapshot.data ?? [];
          if (patients.isEmpty) return const Center(child: Text('No assigned patients.'));
          return RefreshIndicator(
            onRefresh: () async => setState(() => _patientsFuture = _loadPatients()),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: patients.length,
              itemBuilder: (context, index) => _PatientTile(patient: patients[index]),
            ),
          );
        },
      ),
    );
  }
}

class _PatientTile extends StatelessWidget {
  final Map<String, dynamic> patient;
  const _PatientTile({required this.patient});

  @override
  Widget build(BuildContext context) {
    final id = _idOf(patient);
    final user = patient['userId'] is Map ? patient['userId'] as Map : const {};
    final name = '${user['name'] ?? patient['name'] ?? 'Patient'}';
    return Card(
      child: ListTile(
        leading: FutureBuilder<Map<String, dynamic>?>(
          future: id == null ? Future.value(null) : ApiService(authProvider: context.read<AuthProvider>()).fetchLatestVitals(id),
          builder: (context, snapshot) => CircleAvatar(
            backgroundColor: _statusColor(snapshot.data),
            child: const Icon(Icons.person, color: Colors.white),
          ),
        ),
        title: Text(name),
        subtitle: FutureBuilder<Map<String, dynamic>?>(
          future: id == null ? Future.value(null) : ApiService(authProvider: context.read<AuthProvider>()).fetchLatestVitals(id),
          builder: (context, snapshot) => Text(_vitalsSummary(snapshot.data)),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: id == null
            ? null
            : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => PatientDetailScreen(patient: patient))),
      ),
    );
  }
}

class PatientDetailScreen extends StatefulWidget {
  final Map<String, dynamic> patient;
  const PatientDetailScreen({super.key, required this.patient});

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen> {
  late Future<_PatientDetail> _detailFuture;

  @override
  void initState() {
    super.initState();
    _detailFuture = _loadDetail();
  }

  Future<_PatientDetail> _loadDetail() async {
    final id = _idOf(widget.patient);
    if (id == null) throw const ApiException(400, 'Patient ID is missing');
    final api = ApiService(authProvider: context.read<AuthProvider>());
    final results = await Future.wait([api.fetchLatestVitals(id), api.fetchMedications(id), api.fetchExercisePlan(id)]);
    return _PatientDetail(
      vitals: results[0] as Map<String, dynamic>?,
      medications: results[1] as List<Map<String, dynamic>>,
      plan: results[2] as Map<String, dynamic>?,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.patient['userId'] is Map ? widget.patient['userId'] as Map : const {};
    return Scaffold(
      appBar: AppBar(title: Text('${user['name'] ?? widget.patient['name'] ?? 'Patient'}')),
      body: FutureBuilder<_PatientDetail>(
        future: _detailFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Center(child: Text(snapshot.error.toString()));
          final detail = snapshot.data!;
          return ListView(padding: const EdgeInsets.all(16), children: [
            Card(child: ListTile(leading: const Icon(Icons.favorite, color: AppColors.primary), title: const Text('Latest vitals'), subtitle: Text(_vitalsSummary(detail.vitals)))),
            const SizedBox(height: 12),
            Text('Medications', style: Theme.of(context).textTheme.titleLarge),
            ...detail.medications.map((medication) => ListTile(leading: const Icon(Icons.medication_outlined), title: Text('${medication['name'] ?? 'Medication'}'), subtitle: Text('${medication['dosage'] ?? ''}'))),
            const SizedBox(height: 12),
            Text('Exercise plan', style: Theme.of(context).textTheme.titleLarge),
            Card(child: ListTile(leading: const Icon(Icons.fitness_center), title: Text(detail.plan == null ? 'No plan assigned' : '${detail.plan!['frequency'] ?? 'Assigned plan'}'))),
          ]);
        },
      ),
    );
  }
}

class _PatientDetail {
  final Map<String, dynamic>? vitals;
  final List<Map<String, dynamic>> medications;
  final Map<String, dynamic>? plan;
  const _PatientDetail({required this.vitals, required this.medications, required this.plan});
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(message, textAlign: TextAlign.center), const SizedBox(height: 12), ElevatedButton(onPressed: onRetry, child: const Text('Try again'))]));
}

String? _idOf(Map<String, dynamic> value) => (value['_id'] ?? value['id'])?.toString();

String _vitalsSummary(Map<String, dynamic>? vitals) {
  if (vitals == null) return 'No recent vitals';
  return 'HR ${vitals['heartRate'] ?? '--'} BPM  |  SpO2 ${vitals['spo2'] ?? '--'}%';
}

Color _statusColor(Map<String, dynamic>? vitals) {
  if (vitals == null) return AppColors.textSecondary;
  final spo2 = num.tryParse('${vitals['spo2']}');
  return spo2 != null && spo2 < 92 ? Colors.red : AppColors.secondary;
}

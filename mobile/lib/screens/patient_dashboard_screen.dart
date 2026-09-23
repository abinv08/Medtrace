import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class PatientDashboardScreen extends StatefulWidget {
  const PatientDashboardScreen({super.key});

  @override
  State<PatientDashboardScreen> createState() => _PatientDashboardScreenState();
}

class _PatientDashboardScreenState extends State<PatientDashboardScreen> {
  late Future<_PatientData> _dataFuture;

  @override
  void initState() {
    super.initState();
    _dataFuture = _loadData();
  }

  Future<_PatientData> _loadData() async {
    final auth = context.read<AuthProvider>();
    final api = ApiService(authProvider: auth);
    final patientId = auth.currentUser?.id;
    if (patientId == null || patientId.isEmpty) {
      throw const ApiException(400, 'Patient profile is not available');
    }
    final results = await Future.wait([
      api.fetchLatestVitals(patientId),
      api.fetchMedications(patientId),
      api.fetchExercisePlan(patientId),
    ]);
    return _PatientData(
      latestVitals: results[0] as Map<String, dynamic>?,
      medications: results[1] as List<Map<String, dynamic>>,
      exercisePlan: results[2] as Map<String, dynamic>?,
    );
  }

  void _refresh() => setState(() => _dataFuture = _loadData());

  @override
  Widget build(BuildContext context) {
    final userName = context.watch<AuthProvider>().currentUser?.name ?? 'Patient';
    return Scaffold(
      appBar: AppBar(
        title: Text('Hello, $userName'),
        actions: [IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh))],
      ),
      body: FutureBuilder<_PatientData>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _ErrorState(message: snapshot.error.toString(), onRetry: _refresh);
          }
          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('Today', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 16),
                _VitalsCard(vitals: data.latestVitals),
                const SizedBox(height: 16),
                const _SectionTitle(title: "Today's medications"),
                ...data.medications.map((medication) => _MedicationTile(
                      medication: medication,
                      onTaken: () async {
                        final id = _idOf(medication);
                        if (id == null) return;
                        await ApiService(authProvider: context.read<AuthProvider>())
                            .markMedicationTaken(id);
                        _refresh();
                      },
                    )),
                if (data.medications.isEmpty) const _EmptyText(text: 'No medications scheduled.'),
                const SizedBox(height: 16),
                const _SectionTitle(title: 'Current exercise plan'),
                _ExercisePlanCard(plan: data.exercisePlan, onProgress: _refresh),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PatientData {
  final Map<String, dynamic>? latestVitals;
  final List<Map<String, dynamic>> medications;
  final Map<String, dynamic>? exercisePlan;

  const _PatientData({required this.latestVitals, required this.medications, required this.exercisePlan});
}

class _VitalsCard extends StatelessWidget {
  final Map<String, dynamic>? vitals;
  const _VitalsCard({required this.vitals});

  @override
  Widget build(BuildContext context) {
    final values = <String, String>{
      'Heart rate': _display(vitals?['heartRate'], 'BPM'),
      'SpO2': _display(vitals?['spo2'], '%'),
      'Temperature': _display(vitals?['temperature'], '°'),
      'Blood pressure': '${vitals?['bloodPressureSystolic'] ?? '--'}/${vitals?['bloodPressureDiastolic'] ?? '--'}',
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Latest vitals', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          Wrap(
            spacing: 22,
            runSpacing: 16,
            children: values.entries.map((entry) => SizedBox(
                  width: 120,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(entry.key, style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 4),
                    Text(entry.value, style: Theme.of(context).textTheme.titleMedium),
                  ]),
                )).toList(),
          ),
        ]),
      ),
    );
  }

  static String _display(dynamic value, String suffix) => value == null ? '--' : '$value$suffix';
}

class _MedicationTile extends StatelessWidget {
  final Map<String, dynamic> medication;
  final Future<void> Function() onTaken;
  const _MedicationTile({required this.medication, required this.onTaken});

  @override
  Widget build(BuildContext context) {
    final taken = _isTakenToday(medication['takenLog']);
    return Card(
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.medication_outlined)),
        title: Text('${medication['name'] ?? 'Medication'}'),
        subtitle: Text('${medication['dosage'] ?? ''} ${medication['frequency'] ?? ''}'.trim()),
        trailing: taken
            ? const Chip(label: Text('Taken'))
            : TextButton(onPressed: onTaken, child: const Text('Mark taken')),
      ),
    );
  }

  bool _isTakenToday(dynamic log) {
    if (log is! List) return false;
    final today = DateTime.now();
    return log.any((entry) {
      if (entry is! Map) return false;
      final date = DateTime.tryParse('${entry['date']}');
      return entry['taken'] == true && date != null && date.year == today.year && date.month == today.month && date.day == today.day;
    });
  }
}

class _ExercisePlanCard extends StatelessWidget {
  final Map<String, dynamic>? plan;
  final VoidCallback onProgress;
  const _ExercisePlanCard({required this.plan, required this.onProgress});

  @override
  Widget build(BuildContext context) {
    if (plan == null) return const Card(child: _EmptyText(text: 'No exercise plan assigned.'));
    final exercises = plan!['exercises'] is List ? plan!['exercises'] as List : const [];
    return Card(
      child: Column(children: [
        ListTile(
          leading: const Icon(Icons.fitness_center, color: AppColors.secondary),
          title: Text('${plan!['frequency'] ?? 'Exercise plan'}'),
          subtitle: Text('${exercises.length} exercise${exercises.length == 1 ? '' : 's'}'),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () async {
                final id = _idOf(plan!);
                if (id == null) return;
                await ApiService(authProvider: context.read<AuthProvider>()).updateExerciseProgress(id);
                onProgress();
              },
              icon: const Icon(Icons.check),
              label: const Text('Log today\'s progress'),
            ),
          ),
        ),
      ]),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  const _SectionTitle({required this.title});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(title, style: Theme.of(context).textTheme.titleLarge),
      );
}

class _EmptyText extends StatelessWidget {
  final String text;
  const _EmptyText({required this.text});
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.all(16), child: Text(text));
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.cloud_off, size: 48),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: onRetry, child: const Text('Try again')),
        ]),
      ));
}

String? _idOf(Map<String, dynamic> value) => (value['_id'] ?? value['id'])?.toString();

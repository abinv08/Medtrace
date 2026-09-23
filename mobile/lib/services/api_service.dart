import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:http/http.dart' as http;

import '../providers/auth_provider.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;

  const ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiService {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:5000/api',
  );

  final AuthProvider authProvider;
  final http.Client _client;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  ApiService({required this.authProvider, http.Client? client})
      : _client = client ?? http.Client();

  Future<Map<String, String>> _headers() async {
    final token = await authProvider.getAccessToken();
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Uri _uri(String path, [Map<String, String>? queryParameters]) {
    final normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    return Uri.parse('$baseUrl/$normalizedPath').replace(queryParameters: queryParameters);
  }

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String>? query}) async {
    final headers = await _headers();
    final uri = _uri(path, query);
    late http.Response response;

    switch (method) {
      case 'GET':
        response = await _client.get(uri, headers: headers);
        break;
      case 'POST':
        response = await _client.post(uri, headers: headers, body: jsonEncode(body ?? {}));
        break;
      case 'PUT':
        response = await _client.put(uri, headers: headers, body: jsonEncode(body ?? {}));
        break;
      case 'DELETE':
        response = await _client.delete(uri, headers: headers);
        break;
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }

    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map<String, dynamic> && decoded['message'] != null
          ? decoded['message'].toString()
          : 'Request failed';
      throw ApiException(response.statusCode, message);
    }
    return decoded;
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) => _send('GET', path, query: query);

  Future<dynamic> post(String path, {Object? body}) => _send('POST', path, body: body);

  Future<dynamic> put(String path, {Object? body}) => _send('PUT', path, body: body);

  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<List<Map<String, dynamic>>> fetchPatientVitals(String patientId) async {
    final snapshot = await _firestore.collection('vitals').where('patientId', isEqualTo: patientId).get();
    final vitals = snapshot.docs.map((doc) => {'id': doc.id, ..._serialize(doc.data())}).toList();
    vitals.sort((a, b) => _dateValue(b['date'] ?? b['recordedAt']).compareTo(_dateValue(a['date'] ?? a['recordedAt'])));
    return vitals;
  }

  Future<Map<String, dynamic>?> fetchLatestVitals(String patientId) async {
    final vitals = await fetchPatientVitals(patientId);
    return vitals.isEmpty ? null : vitals.first;
  }

  Future<List<Map<String, dynamic>>> fetchMedications(String patientId) async {
    final snapshot = await _firestore.collection('medications').where('patientId', isEqualTo: patientId).get();
    final logsSnapshot = await _firestore.collection('medicationLogs').where('patientId', isEqualTo: patientId).get();
    final logsByMedication = <String, List<Map<String, dynamic>>>{};
    for (final log in logsSnapshot.docs) {
      final data = _serialize(log.data());
      final medicationId = data['medicationId']?.toString();
      if (medicationId != null) {
        logsByMedication.putIfAbsent(medicationId, () => []).add(data);
      }
    }
    return snapshot.docs.map((doc) {
      final data = _serialize(doc.data());
      return {
        'id': doc.id,
        ...data,
        'takenLog': logsByMedication[doc.id] ?? <Map<String, dynamic>>[],
      };
    }).toList();
  }

  Future<Map<String, dynamic>> markMedicationTaken(String medicationId) async {
    final reference = _firestore.collection('medications').doc(medicationId);
    final snapshot = await reference.get();
    if (!snapshot.exists) throw const ApiException(404, 'Medication not found');
    final data = _serialize(snapshot.data() ?? {});
    final log = {
      'id': 'doselog-$medicationId-${DateTime.now().toIso8601String().substring(0, 10)}',
      'patientId': data['patientId'],
      'medicationId': medicationId,
      'medicationName': data['name'],
      'date': DateTime.now().toIso8601String().substring(0, 10),
      'status': 'taken',
      'loggedAt': FieldValue.serverTimestamp(),
    };
    await _firestore.collection('medicationLogs').doc(log['id'] as String).set(log);
    return {'id': snapshot.id, ...data, 'takenLog': [log]};
  }

  Future<Map<String, dynamic>?> fetchExercisePlan(String patientId) async {
    final snapshot = await _firestore.collection('exercisePlans').where('patientId', isEqualTo: patientId).limit(1).get();
    if (snapshot.docs.isEmpty) return null;
    return {'id': snapshot.docs.first.id, ..._serialize(snapshot.docs.first.data())};
  }

  Future<Map<String, dynamic>> updateExerciseProgress(
    String planId, {
    bool completed = true,
    String? notes,
  }) async {
    final reference = _firestore.collection('exercisePlans').doc(planId);
    final snapshot = await reference.get();
    if (!snapshot.exists) throw const ApiException(404, 'Exercise plan not found');
    final data = _serialize(snapshot.data() ?? {});
    final progressLog = List<Map<String, dynamic>>.from(_mapList(data['progressLog']));
    progressLog.add({
      'date': DateTime.now().toIso8601String(),
      'completed': completed,
      if (notes != null) 'notes': notes,
    });
    await reference.update({'progressLog': progressLog});
    return {'id': snapshot.id, ...data, 'progressLog': progressLog};
  }

  Future<List<Map<String, dynamic>>> fetchPatientsByDoctor(String doctorId) async {
    final snapshot = await _firestore.collection('users').where('assignedDoctor', isEqualTo: doctorId).get();
    return snapshot.docs.map((doc) => {'id': doc.id, ..._serialize(doc.data())}).toList();
  }

  Future<List<Map<String, dynamic>>> fetchCaretakerPatients(String caretakerId) async {
    final snapshot = await _firestore.collection('users').where('assignedCaretakers', arrayContains: caretakerId).get();
    return snapshot.docs.map((doc) => {'id': doc.id, ..._serialize(doc.data())}).toList();
  }

  static List<Map<String, dynamic>> _mapList(dynamic value) {
    if (value is! List) return <Map<String, dynamic>>[];
    return value.whereType<Map<String, dynamic>>().toList();
  }

  static Map<String, dynamic> _serialize(Map<String, dynamic> value) {
    return value.map((key, item) => MapEntry(key, item is Timestamp ? item.toDate().toIso8601String() : item));
  }

  static DateTime _dateValue(dynamic value) {
    return DateTime.tryParse('$value') ?? DateTime.fromMillisecondsSinceEpoch(0);
  }
}


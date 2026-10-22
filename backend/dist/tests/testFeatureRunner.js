"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const server_1 = require("../server");
const db_1 = require("../config/db");
const User_1 = require("../models/User");
const Patient_1 = require("../models/Patient");
const Vitals_1 = require("../models/Vitals");
const Appointment_1 = require("../models/Appointment");
const TestResult_1 = require("../models/TestResult");
const NurseAssignment_1 = require("../models/NurseAssignment");
const NurseTask_1 = require("../models/NurseTask");
function dutyWindow(duty, now = new Date()) {
    const start = new Date(`${duty.dutyDate}T${duty.startTime}:00`);
    const end = new Date(`${duty.dutyDate}T${duty.endTime}:00`);
    if (end <= start)
        end.setDate(end.getDate() + 1);
    const state = duty.status === 'cancelled'
        ? 'cancelled'
        : now < start
            ? 'scheduled'
            : now <= end
                ? 'active'
                : 'completed';
    return { start, end, state };
}
function assertDutyTransition(currentAttendance, action) {
    const transitions = {
        checkIn: ['checked_in', ['not_checked_in']],
        startBreak: ['on_break', ['checked_in']],
        endBreak: ['checked_in', ['on_break']],
        checkOut: ['checked_out', ['checked_in']],
    };
    const transition = transitions[action];
    if (!transition)
        throw new Error(`Unknown action: ${action}`);
    if (!transition[1].includes(currentAttendance)) {
        throw new Error(`Cannot transition from ${currentAttendance} via ${action}`);
    }
    return transition[0];
}
const testResults = [];
async function recordTest(feature, testCase, fn) {
    const start = Date.now();
    try {
        await fn();
        const durationMs = Date.now() - start;
        testResults.push({ feature, testCase, status: 'PASS', durationMs });
        console.log(`  ✅ [PASS] ${testCase} (${durationMs}ms)`);
    }
    catch (err) {
        const durationMs = Date.now() - start;
        testResults.push({
            feature,
            testCase,
            status: 'FAIL',
            details: err.message || String(err),
            durationMs,
        });
        console.error(`  ❌ [FAIL] ${testCase} (${durationMs}ms): ${err.message}`);
    }
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
async function runFeatureTests() {
    console.log('================================================================');
    console.log('🩺 MEDTRACE FEATURE INTEGRATION TEST SUITE');
    console.log('Features: Registration, Login, Patient Log Vitals,');
    console.log('          Doctor Appointment, Medical Report Upload, Nurses Active Check');
    console.log('================================================================\n');
    // Connect to DB
    await (0, db_1.connectDB)();
    // Start HTTP server on random free port
    const server = http_1.default.createServer(server_1.app);
    await new Promise((resolve) => server.listen(0, resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    console.log(`🌐 Test server listening at: ${baseUrl}\n`);
    const uniqueSuffix = Date.now().toString().slice(-6);
    const patientEmail = `test.patient.${uniqueSuffix}@medtrace.org`;
    const doctorEmail = `test.doctor.${uniqueSuffix}@medtrace.org`;
    const nurseEmail = `test.nurse.${uniqueSuffix}@medtrace.org`;
    const headNurseEmail = `test.headnurse.${uniqueSuffix}@medtrace.org`;
    const defaultPassword = 'SecurePassword123!';
    let patientToken = '';
    let doctorToken = '';
    let nurseToken = '';
    let headNurseToken = '';
    let patientId = '';
    let doctorId = '';
    let nurseId = '';
    let headNurseId = '';
    let patientDocId = ''; // Patient MongoDB collection document ID
    try {
        // =========================================================================
        // FEATURE 1: REGISTRATION
        // =========================================================================
        console.log('🔹 FEATURE 1: REGISTRATION');
        await recordTest('Registration', 'Register Patient with complete valid payload', async () => {
            const res = await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Jane Patient',
                    email: patientEmail,
                    password: defaultPassword,
                    phone: '+1 555-0199',
                    hospitalName: 'MedTrace General Hospital',
                    department: 'General Medicine',
                    role: 'Patient',
                }),
            });
            const data = await res.json();
            assert(res.status === 201, `Expected status 201, got ${res.status}: ${JSON.stringify(data)}`);
            assert(data.success === true, 'Expected success: true');
            assert(data.user?.email === patientEmail, `Email mismatch: ${data.user?.email}`);
            assert(data.user?.role === 'Patient', `Role mismatch: ${data.user?.role}`);
            assert(Boolean(data.accessToken), 'Expected accessToken in response');
            patientToken = data.accessToken;
            patientId = data.user.id;
            // Ensure Patient document exists for relational operations
            let pDoc = await Patient_1.Patient.findOne({ userId: patientId });
            if (!pDoc) {
                pDoc = await Patient_1.Patient.create({ userId: patientId, assignedCaretakers: [] });
            }
            patientDocId = pDoc._id.toString();
        });
        await recordTest('Registration', 'Reject duplicate email registration with 400', async () => {
            const res = await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Duplicate Jane',
                    email: patientEmail,
                    password: defaultPassword,
                    phone: '+1 555-0199',
                    hospitalName: 'MedTrace General Hospital',
                    department: 'General Medicine',
                    role: 'Patient',
                }),
            });
            const data = await res.json();
            assert(res.status === 400, `Expected 400 for duplicate, got ${res.status}`);
            assert(data.success === false, 'Expected success: false');
            assert(data.message.includes('already exists') || data.message.includes('exists'), `Expected duplicate message, got: ${data.message}`);
        });
        await recordTest('Registration', 'Reject registration when required fields are missing or password is weak', async () => {
            const res = await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Bad Reg',
                    email: 'invalid-email-address',
                    password: '123', // < 6 chars
                    role: 'Patient',
                }),
            });
            const data = await res.json();
            assert(res.status === 400, `Expected 400 validation error, got ${res.status}`);
            assert(data.success === false, 'Expected success: false');
        });
        await recordTest('Registration', 'Register Doctor and Head Nurse accounts for downstream role testing', async () => {
            // Register Doctor
            const docRes = await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Dr. Gregory House',
                    email: doctorEmail,
                    password: defaultPassword,
                    phone: '+1 555-0200',
                    hospitalName: 'MedTrace General Hospital',
                    department: 'Cardiology',
                    role: 'Doctor',
                }),
            });
            const docData = await docRes.json();
            assert(docRes.status === 201, `Failed to register doctor: ${JSON.stringify(docData)}`);
            doctorToken = docData.accessToken;
            doctorId = docData.user.id;
            // Register Nurse
            const nurseRes = await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Nurse Jackie',
                    email: nurseEmail,
                    password: defaultPassword,
                    phone: '+1 555-0300',
                    hospitalName: 'MedTrace General Hospital',
                    department: 'ICU',
                    role: 'Nurse',
                }),
            });
            const nurseData = await nurseRes.json();
            assert(nurseRes.status === 201, `Failed to register nurse: ${JSON.stringify(nurseData)}`);
            nurseToken = nurseData.accessToken;
            nurseId = nurseData.user.id;
            // Register Head Nurse
            const hnRes = await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Head Nurse Florence',
                    email: headNurseEmail,
                    password: defaultPassword,
                    phone: '+1 555-0400',
                    hospitalName: 'MedTrace General Hospital',
                    department: 'Ward Management',
                    role: 'Head Nurse',
                }),
            });
            const hnData = await hnRes.json();
            assert(hnRes.status === 201, `Failed to register head nurse: ${JSON.stringify(hnData)}`);
            headNurseToken = hnData.accessToken;
            headNurseId = hnData.user.id;
        });
        // =========================================================================
        // FEATURE 2: LOGIN
        // =========================================================================
        console.log('\n🔹 FEATURE 2: LOGIN');
        await recordTest('Login', 'Successful login with valid credentials returns tokens and user profile', async () => {
            const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: patientEmail,
                    password: defaultPassword,
                    rememberMe: true,
                }),
            });
            const data = await res.json();
            assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
            assert(data.success === true, 'Expected success: true');
            assert(Boolean(data.accessToken), 'Expected accessToken in login response');
            assert(data.user?.email === patientEmail, 'Logged in user email mismatch');
            assert(data.user?.role === 'Patient', 'Logged in user role mismatch');
            // Refresh stored patientToken to latest
            patientToken = data.accessToken;
        });
        await recordTest('Login', 'Reject login with incorrect password with 401', async () => {
            const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: patientEmail,
                    password: 'WrongPassword!',
                }),
            });
            const data = await res.json();
            assert(res.status === 401, `Expected 401, got ${res.status}`);
            assert(data.success === false, 'Expected success: false');
            assert(data.message.includes('Invalid') || data.message.includes('credentials'), `Unexpected error message: ${data.message}`);
        });
        await recordTest('Login', 'Reject login with non-existent email with 401', async () => {
            const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'nonexistent.user.2026@medtrace.org',
                    password: 'SomePassword123!',
                }),
            });
            const data = await res.json();
            assert(res.status === 401, `Expected 401, got ${res.status}`);
            assert(data.success === false, 'Expected success: false');
        });
        await recordTest('Login', 'Access protected /api/auth/me using issued JWT token', async () => {
            const res = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { Authorization: `Bearer ${patientToken}` },
            });
            const data = await res.json();
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(data.success === true, 'Expected success: true');
            assert(data.user?.id === patientId, 'User ID in me endpoint mismatch');
        });
        // =========================================================================
        // FEATURE 3: PATIENT LOG VITALS
        // =========================================================================
        console.log('\n🔹 FEATURE 3: PATIENT LOG VITALS');
        await recordTest('Patient Log Vitals', 'Create initial vitals record (heartRate, spo2, BP, temp)', async () => {
            const vitalsPayload = {
                patientId: patientDocId,
                heartRate: 74,
                spo2: 98,
                bloodPressureSystolic: 118,
                bloodPressureDiastolic: 78,
                temperature: 98.4,
                source: 'manual',
                recordedAt: new Date(Date.now() - 3600000).toISOString(),
            };
            const res = await fetch(`${baseUrl}/api/vitals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${patientToken}`,
                },
                body: JSON.stringify(vitalsPayload),
            });
            const data = await res.json();
            assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
            assert(data.success === true, 'Expected success: true');
            assert(data.vitals?.heartRate === 74, `Expected HR 74, got ${data.vitals?.heartRate}`);
            assert(data.vitals?.spo2 === 98, `Expected SpO2 98, got ${data.vitals?.spo2}`);
        });
        await recordTest('Patient Log Vitals', 'Record updated vitals and verify GET /:patientId/latest reflects newest reading', async () => {
            const newerVitals = {
                patientId: patientDocId,
                heartRate: 85,
                spo2: 99,
                bloodPressureSystolic: 122,
                bloodPressureDiastolic: 82,
                temperature: 99.1,
                source: 'manual',
                recordedAt: new Date().toISOString(),
            };
            const postRes = await fetch(`${baseUrl}/api/vitals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${patientToken}`,
                },
                body: JSON.stringify(newerVitals),
            });
            assert(postRes.status === 201, `Failed to post newer vitals: ${postRes.status}`);
            // Query latest
            const getRes = await fetch(`${baseUrl}/api/vitals/${patientDocId}/latest`, {
                headers: { Authorization: `Bearer ${patientToken}` },
            });
            const getData = await getRes.json();
            assert(getRes.status === 200, `Expected 200, got ${getRes.status}: ${JSON.stringify(getData)}`);
            assert(getData.success === true, 'Expected success: true');
            assert(getData.vitals?.heartRate === 85, `Expected latest HR 85, got ${getData.vitals?.heartRate}`);
            assert(getData.vitals?.spo2 === 99, `Expected latest SpO2 99, got ${getData.vitals?.spo2}`);
            assert(getData.vitals?.temperature === 99.1, `Expected latest Temp 99.1, got ${getData.vitals?.temperature}`);
        });
        await recordTest('Patient Log Vitals', 'Retrieve full patient vitals history list', async () => {
            const res = await fetch(`${baseUrl}/api/vitals/${patientDocId}`, {
                headers: { Authorization: `Bearer ${patientToken}` },
            });
            const data = await res.json();
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(data.success === true, 'Expected success: true');
            assert(Array.isArray(data.vitals), 'Expected array of vitals');
            assert(data.vitals.length >= 2, `Expected at least 2 vitals in history, got ${data.vitals.length}`);
        });
        await recordTest('Patient Log Vitals', 'Reject vitals submission without authentication with 401', async () => {
            const res = await fetch(`${baseUrl}/api/vitals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: patientDocId, heartRate: 80 }),
            });
            assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
        });
        // =========================================================================
        // FEATURE 4: DOCTOR APPOINTMENT
        // =========================================================================
        console.log('\n🔹 FEATURE 4: DOCTOR APPOINTMENT');
        let appointmentId = '';
        await recordTest('Doctor Appointment', 'Book a new doctor appointment with patient, doctor, date/time, and reason', async () => {
            const appointmentDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
            const appointmentPayload = {
                patientId: patientDocId,
                doctorId: doctorId,
                dateTime: appointmentDate,
                reason: 'Comprehensive Cardiovascular Consultation',
                notes: 'Patient reports occasional palpitations during exercise.',
                status: 'pending',
            };
            const res = await fetch(`${baseUrl}/api/appointments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${patientToken}`,
                },
                body: JSON.stringify(appointmentPayload),
            });
            const data = await res.json();
            assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
            assert(data.success === true, 'Expected success: true');
            assert(data.appointment?.status === 'pending', `Expected pending status, got: ${data.appointment?.status}`);
            assert(data.appointment?.reason === appointmentPayload.reason, 'Reason mismatch');
            appointmentId = data.appointment._id || data.appointment.id;
            assert(Boolean(appointmentId), 'Expected appointment ID to be returned');
        });
        await recordTest('Doctor Appointment', 'Retrieve booked appointments filtered by patientId', async () => {
            const res = await fetch(`${baseUrl}/api/appointments?patientId=${patientDocId}`, {
                headers: { Authorization: `Bearer ${patientToken}` },
            });
            const data = await res.json();
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(data.success === true, 'Expected success: true');
            assert(Array.isArray(data.appointments), 'Expected appointments array');
            const found = data.appointments.some((apt) => (apt._id || apt.id) === appointmentId);
            assert(found, `Booked appointment ${appointmentId} not found in patient list`);
        });
        await recordTest('Doctor Appointment', 'Retrieve booked appointments filtered by doctorId', async () => {
            const res = await fetch(`${baseUrl}/api/appointments?doctorId=${doctorId}`, {
                headers: { Authorization: `Bearer ${doctorToken}` },
            });
            const data = await res.json();
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(data.success === true, 'Expected success: true');
            assert(Array.isArray(data.appointments), 'Expected appointments array');
            const found = data.appointments.some((apt) => (apt._id || apt.id) === appointmentId);
            assert(found, `Booked appointment ${appointmentId} not found in doctor appointments list`);
        });
        await recordTest('Doctor Appointment', 'Update appointment status from pending to confirmed', async () => {
            const res = await fetch(`${baseUrl}/api/appointments/${appointmentId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${doctorToken}`,
                },
                body: JSON.stringify({ status: 'confirmed' }),
            });
            const data = await res.json();
            assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
            assert(data.success === true, 'Expected success: true');
            assert(data.appointment?.status === 'confirmed', `Expected status confirmed, got ${data.appointment?.status}`);
        });
        // =========================================================================
        // FEATURE 5: MEDICAL REPORT UPLOAD
        // =========================================================================
        console.log('\n🔹 FEATURE 5: MEDICAL REPORT UPLOAD');
        let uploadedFileId = '';
        const sampleReportContent = `
======================================================
MEDTRACE CLINICAL LABORATORY REPORT
Date: 2026-10-06
Patient: Jane Patient (ID: ${patientDocId})
Doctor: Dr. Gregory House
Test: Complete Blood Count (CBC) with Differential
------------------------------------------------------
White Blood Cell (WBC): 6.8 K/uL   (Normal: 4.5 - 11.0)
Red Blood Cell (RBC):   4.72 M/uL  (Normal: 4.0 - 5.2)
Hemoglobin:             14.2 g/dL  (Normal: 12.0 - 16.0)
Hematocrit:             41.8 %     (Normal: 36.0 - 46.0)
Platelet Count:         245 K/uL   (Normal: 150 - 450)
Status: COMPLETED / NORMAL
======================================================
    `.trim();
        await recordTest('Medical Report Upload', 'Upload diagnostic lab report file with metadata via multipart/form-data', async () => {
            const formData = new FormData();
            formData.append('patientId', patientDocId);
            formData.append('category', 'Complete Blood Count (CBC)');
            formData.append('notes', 'Routine pre-op laboratory blood test report');
            const fileBlob = new Blob([sampleReportContent], { type: 'text/plain' });
            formData.append('file', fileBlob, 'cbc_lab_diagnostic_report.txt');
            const res = await fetch(`${baseUrl}/api/test-results`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${doctorToken}`,
                },
                body: formData,
            });
            const data = await res.json();
            assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
            assert(data.success === true, 'Expected success: true');
            assert(data.testResult?.category === 'Complete Blood Count (CBC)', 'Category mismatch');
            assert(Boolean(data.testResult?.fileUrl), 'Expected fileUrl in uploaded test result');
            // Extract filename from fileUrl (e.g. /api/test-results/file/test-result-...)
            const fileUrl = data.testResult.fileUrl;
            uploadedFileId = fileUrl.split('/').pop() || '';
            assert(Boolean(uploadedFileId), 'Expected file ID from fileUrl');
        });
        await recordTest('Medical Report Upload', 'Fetch uploaded medical reports for patient via GET /api/test-results/:patientId', async () => {
            const res = await fetch(`${baseUrl}/api/test-results/${patientDocId}`, {
                headers: { Authorization: `Bearer ${patientToken}` },
            });
            const data = await res.json();
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(data.success === true, 'Expected success: true');
            assert(Array.isArray(data.testResults), 'Expected testResults array');
            const matching = data.testResults.find((tr) => tr.fileUrl?.includes(uploadedFileId));
            assert(Boolean(matching), `Uploaded test result with file ${uploadedFileId} not found in patient reports`);
        });
        await recordTest('Medical Report Upload', 'Download / stream uploaded medical report file via GET /api/test-results/file/:id', async () => {
            const res = await fetch(`${baseUrl}/api/test-results/file/${uploadedFileId}`, {
                headers: { Authorization: `Bearer ${patientToken}` },
            });
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const fileContent = await res.text();
            assert(fileContent.includes('MEDTRACE CLINICAL LABORATORY REPORT'), 'Downloaded file content does not match report header');
            assert(fileContent.includes('Platelet Count:         245 K/uL'), 'Downloaded file content missing biomarker data');
        });
        // =========================================================================
        // FEATURE 6: NURSES ACTIVE CHECK
        // =========================================================================
        console.log('\n🔹 FEATURE 6: NURSES ACTIVE CHECK');
        await recordTest('Nurses Active Check', 'Duty window active check: current time inside duty window evaluates to "active"', async () => {
            const now = new Date();
            const todayDate = now.toISOString().split('T')[0];
            const startHour = String(Math.max(0, now.getHours() - 1)).padStart(2, '0');
            const endHour = String(Math.min(23, now.getHours() + 2)).padStart(2, '0');
            const activeDuty = {
                dutyDate: todayDate,
                startTime: `${startHour}:00`,
                endTime: `${endHour}:00`,
                status: 'scheduled',
                attendanceStatus: 'checked_in',
            };
            const windowResult = dutyWindow(activeDuty, now);
            assert(windowResult.state === 'active', `Expected duty state 'active', got: ${windowResult.state}`);
        });
        await recordTest('Nurses Active Check', 'Duty window state transitions: scheduled (future), active (now), completed (past)', async () => {
            const now = new Date();
            const todayDate = now.toISOString().split('T')[0];
            // Future duty (starts tomorrow)
            const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
            const futureDuty = {
                dutyDate: tomorrow,
                startTime: '08:00',
                endTime: '16:00',
                status: 'scheduled',
                attendanceStatus: 'not_checked_in',
            };
            assert(dutyWindow(futureDuty, now).state === 'scheduled', 'Expected future duty to be "scheduled"');
            // Past duty (yesterday)
            const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
            const pastDuty = {
                dutyDate: yesterday,
                startTime: '08:00',
                endTime: '16:00',
                status: 'scheduled',
                attendanceStatus: 'checked_out',
            };
            assert(dutyWindow(pastDuty, now).state === 'completed', 'Expected past duty to be "completed"');
            // Cancelled duty
            const cancelledDuty = {
                dutyDate: todayDate,
                startTime: '00:00',
                endTime: '23:59',
                status: 'cancelled',
                attendanceStatus: 'not_checked_in',
            };
            assert(dutyWindow(cancelledDuty, now).state === 'cancelled', 'Expected cancelled duty to be "cancelled"');
        });
        await recordTest('Nurses Active Check', 'Attendance status lifecycle transitions (not_checked_in -> checked_in -> on_break -> checked_in -> checked_out)', async () => {
            // 1. Initial check-in
            let status = 'not_checked_in';
            status = assertDutyTransition(status, 'checkIn');
            assert(status === 'checked_in', `Expected checked_in, got ${status}`);
            // 2. Start break
            status = assertDutyTransition(status, 'startBreak');
            assert(status === 'on_break', `Expected on_break, got ${status}`);
            // 3. End break
            status = assertDutyTransition(status, 'endBreak');
            assert(status === 'checked_in', `Expected checked_in, got ${status}`);
            // 4. Check out
            status = assertDutyTransition(status, 'checkOut');
            assert(status === 'checked_out', `Expected checked_out, got ${status}`);
            // 5. Invalid transition: checking in when already checked out should throw
            let threw = false;
            try {
                assertDutyTransition(status, 'checkIn');
            }
            catch {
                threw = true;
            }
            assert(threw, 'Expected transition checkIn from checked_out to throw an error');
        });
        await recordTest('Nurses Active Check', 'Nurse assignment to patient via POST /api/nurse-assignments and verify roster query', async () => {
            // Head nurse assigns Nurse to Patient
            const assignRes = await fetch(`${baseUrl}/api/nurse-assignments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${headNurseToken}`,
                },
                body: JSON.stringify({
                    nurseId: nurseId,
                    patientId: patientDocId,
                    ward: 'Cardiology Ward 3B',
                    shift: 'day',
                }),
            });
            const assignData = await assignRes.json();
            assert(assignRes.status === 201, `Expected 201, got ${assignRes.status}: ${JSON.stringify(assignData)}`);
            assert(assignData.success === true, 'Expected success: true');
            // Nurse queries assigned patients
            const listRes = await fetch(`${baseUrl}/api/nurse-assignments/${nurseId}/patients`, {
                headers: { Authorization: `Bearer ${nurseToken}` },
            });
            const listData = await listRes.json();
            assert(listRes.status === 200, `Expected 200, got ${listRes.status}`);
            assert(listData.success === true, 'Expected success: true');
            assert(Array.isArray(listData.assignments), 'Expected assignments array');
            const found = listData.assignments.some((asgn) => asgn.patientId?._id === patientDocId || asgn.patientId === patientDocId);
            assert(found, `Assigned patient ${patientDocId} not found in nurse patient roster`);
        });
        await recordTest('Nurses Active Check', 'Nurse task workflow: create task, approve by Head Nurse, and complete by Nurse', async () => {
            // 1. Create task
            const createRes = await fetch(`${baseUrl}/api/nurse-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${headNurseToken}`,
                },
                body: JSON.stringify({
                    patientId: patientDocId,
                    assignedNurse: nurseId,
                    taskDescription: 'Administer 50mg Metoprolol & log vitals hourly',
                    dueAt: new Date(Date.now() + 7200000).toISOString(),
                }),
            });
            const createData = await createRes.json();
            assert(createRes.status === 201, `Failed to create task: ${createRes.status}`);
            const taskId = createData.task._id || createData.task.id;
            assert(createData.task.status === 'pending_approval', 'Expected status pending_approval');
            // 2. Head nurse approves task
            const approveRes = await fetch(`${baseUrl}/api/nurse-tasks/${taskId}/approve`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${headNurseToken}` },
            });
            const approveData = await approveRes.json();
            assert(approveRes.status === 200, `Failed to approve task: ${approveRes.status}`);
            assert(approveData.task.status === 'approved', 'Expected status approved');
            // 3. Nurse completes task
            const completeRes = await fetch(`${baseUrl}/api/nurse-tasks/${taskId}/complete`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${nurseToken}` },
            });
            const completeData = await completeRes.json();
            assert(completeRes.status === 200, `Failed to complete task: ${completeRes.status}`);
            assert(completeData.task.status === 'completed', 'Expected status completed');
        });
    }
    finally {
        // Cleanup HTTP server and DB connections
        server.close();
        try {
            // Cleanup created test records
            if (patientId)
                await User_1.User.deleteMany({ email: { $in: [patientEmail, doctorEmail, nurseEmail, headNurseEmail] } });
            if (patientDocId) {
                await Patient_1.Patient.findByIdAndDelete(patientDocId);
                await Vitals_1.Vitals.deleteMany({ patientId: patientDocId });
                await Appointment_1.Appointment.deleteMany({ patientId: patientDocId });
                await TestResult_1.TestResult.deleteMany({ patientId: patientDocId });
                await NurseAssignment_1.NurseAssignment.deleteMany({ patientId: patientDocId });
                await NurseTask_1.NurseTask.deleteMany({ patientId: patientDocId });
            }
        }
        catch (cleanupErr) {
            console.warn('Cleanup warning:', cleanupErr);
        }
        await mongoose_1.default.disconnect();
    }
    // =========================================================================
    // SUMMARY REPORT
    // =========================================================================
    console.log('\n================================================================');
    console.log('📊 TEST EXECUTION SUMMARY REPORT');
    console.log('================================================================');
    const grouped = {};
    testResults.forEach((r) => {
        grouped[r.feature] = grouped[r.feature] || [];
        grouped[r.feature].push(r);
    });
    let totalPass = 0;
    let totalFail = 0;
    for (const [feature, items] of Object.entries(grouped)) {
        const passed = items.filter((i) => i.status === 'PASS').length;
        const failed = items.filter((i) => i.status === 'FAIL').length;
        totalPass += passed;
        totalFail += failed;
        console.log(`\n📌 ${feature}: ${passed}/${items.length} Passed`);
        items.forEach((i) => {
            const badge = i.status === 'PASS' ? '✅' : '❌';
            console.log(`   ${badge} ${i.testCase} (${i.durationMs}ms)`);
            if (i.details)
                console.log(`      ⚠️ Error: ${i.details}`);
        });
    }
    console.log('\n----------------------------------------------------------------');
    console.log(`TOTAL: ${totalPass + totalFail} Tests | PASSED: ${totalPass} | FAILED: ${totalFail}`);
    console.log('================================================================\n');
    if (totalFail > 0) {
        process.exit(1);
    }
    else {
        process.exit(0);
    }
}
// Execute tests
runFeatureTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
});

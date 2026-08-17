import 'package:flutter_test/flutter_test.dart';
import 'package:medtrace_mobile/main.dart';

void main() {
  testWidgets('MedTrace app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MedTraceApp());
    expect(find.byType(MedTraceApp), findsOneWidget);
  });
}

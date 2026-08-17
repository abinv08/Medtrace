import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class MedTraceLogoWidget extends StatelessWidget {
  final double size;
  final bool showText;

  const MedTraceLogoWidget({
    Key? key,
    this.size = 48.0,
    this.showText = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(size * 0.28),
            gradient: const LinearGradient(
              colors: [Color(0xFF2563EB), Color(0xFF14B8A6), Color(0xFF8B5CF6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF2563EB).withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: CustomPaint(
            painter: MedTraceLogoPainter(),
          ),
        ),
        if (showText) ...[
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'MEDTRACE',
                style: GoogleFonts.inter(
                  fontSize: size * 0.42,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  color: const Color(0xFF0F172A),
                  height: 1.0,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Clinical Intelligence',
                style: GoogleFonts.inter(
                  fontSize: size * 0.2,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class MedTraceLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final strokeWidth = size.width * 0.1;

    // Cross Paint
    final crossPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    // Vertical line
    canvas.drawLine(
      Offset(center.dx, size.height * 0.22),
      Offset(center.dx, size.height * 0.78),
      crossPaint,
    );

    // Horizontal line
    canvas.drawLine(
      Offset(size.width * 0.22, center.dy),
      Offset(size.width * 0.78, center.dy),
      crossPaint,
    );

    // Heartbeat Pulse Line
    final pulsePaint = Paint()
      ..color = Colors.white
      ..strokeWidth = strokeWidth * 0.35
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path()
      ..moveTo(size.width * 0.25, center.dy)
      ..lineTo(size.width * 0.38, center.dy)
      ..lineTo(size.width * 0.44, size.height * 0.32)
      ..lineTo(size.width * 0.54, size.height * 0.68)
      ..lineTo(size.width * 0.60, size.height * 0.42)
      ..lineTo(size.width * 0.66, center.dy)
      ..lineTo(size.width * 0.75, center.dy);

    canvas.drawPath(path, pulsePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

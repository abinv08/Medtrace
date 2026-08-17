import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/auth_provider.dart';
import '../widgets/medtrace_logo.dart';
import '../utils/validators.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({Key? key}) : super(key: key);

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String _selectedRole = 'Patient';
  bool _agreeToTerms = false;
  bool _obscurePassword = true;

  final List<String> _roles = [
    'Patient',
    'Guardian',
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _handleRegister() async {
    if (!_agreeToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You must agree to the Privacy Policy & Data Handling Terms'),
          backgroundColor: Colors.deepOrange,
        ),
      );
      return;
    }

    if (_formKey.currentState!.validate()) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final success = await auth.register(
        name: _nameController.text.trim(),
        email: _emailController.text.trim(),
        phone: _phoneController.text.trim(),
        password: _passwordController.text,
        role: _selectedRole,
      );

      if (success && mounted) {
        final routeRole = _selectedRole.toLowerCase().replaceAll(' ', '-');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Registration successful! Welcome to MedTrace.'),
            backgroundColor: const Color(0xFF2563EB),
          ),
        );
        context.go('/dashboard/$routeRole');
      } else if (mounted && auth.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(auth.errorMessage!),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => context.pop(),
        ),
        title: const MedTraceLogoWidget(size: 36, showText: true),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 480),
              padding: const EdgeInsets.all(24.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18.0),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF2563EB).withOpacity(0.08),
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Create MedTrace Account',
                      style: GoogleFonts.inter(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Join the AI Clinical Intelligence & Contactless Sensing Network',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Full Name
                    TextFormField(
                      controller: _nameController,
                      validator: (v) => AppValidators.validateRequired(v, 'Full Name'),
                      decoration: const InputDecoration(
                        labelText: 'Full Name *',
                        hintText: 'Dr. Alexander Wright',
                        prefixIcon: Icon(Icons.person_outline, color: Color(0xFF94A3B8)),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Email Address
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      validator: AppValidators.validateEmail,
                      decoration: const InputDecoration(
                        labelText: 'Email Address *',
                        hintText: 'wright@cityhospital.org',
                        prefixIcon: Icon(Icons.email_outlined, color: Color(0xFF94A3B8)),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Phone Number
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      validator: AppValidators.validatePhone,
                      decoration: const InputDecoration(
                        labelText: 'Phone Number *',
                        hintText: '+1 (555) 234-5678',
                        prefixIcon: Icon(Icons.phone_outlined, color: Color(0xFF94A3B8)),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Role Selection Dropdown
                    DropdownButtonFormField<String>(
                      value: _selectedRole,
                      decoration: const InputDecoration(
                        labelText: 'Role *',
                        prefixIcon: Icon(Icons.badge_outlined, color: Color(0xFF94A3B8)),
                      ),
                      items: _roles.map((role) {
                        return DropdownMenuItem(
                          value: role,
                          child: Text(role, style: GoogleFonts.inter(fontSize: 14)),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedRole = val);
                      },
                    ),
                    const SizedBox(height: 16),

                    // (Hospital name is fixed for this system — no input needed)
                    const SizedBox(height: 16),

                    // Password
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      validator: AppValidators.validatePassword,
                      decoration: InputDecoration(
                        labelText: 'Password *',
                        hintText: '••••••••',
                        prefixIcon: const Icon(Icons.lock_outlined, color: Color(0xFF94A3B8)),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_off : Icons.visibility,
                            color: const Color(0xFF94A3B8),
                          ),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Confirm Password
                    TextFormField(
                      controller: _confirmPasswordController,
                      obscureText: _obscurePassword,
                      validator: (v) => AppValidators.validateConfirmPassword(v, _passwordController.text),
                      decoration: const InputDecoration(
                        labelText: 'Confirm Password *',
                        hintText: '••••••••',
                        prefixIcon: Icon(Icons.lock_reset_outlined, color: Color(0xFF94A3B8)),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Checkbox Privacy Policy
                    Row(
                      children: [
                        Checkbox(
                          value: _agreeToTerms,
                          activeColor: const Color(0xFF2563EB),
                          onChanged: (v) => setState(() => _agreeToTerms = v ?? false),
                        ),
                        Expanded(
                          child: Text(
                            'I agree to the Privacy Policy & Data Handling Terms',
                            style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF475569)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Submit Button
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: auth.isLoading ? null : _handleRegister,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18.0),
                          ),
                        ),
                        child: auth.isLoading
                            ? const SizedBox(
                                height: 24,
                                width: 24,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                              )
                            : Text(
                                'Create Account',
                                style: GoogleFonts.inter(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

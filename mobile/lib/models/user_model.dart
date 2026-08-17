class UserModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String hospitalName;
  final String role;
  final String? createdAt;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.hospitalName,
    required this.role,
    this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      hospitalName: json['hospitalName'] ?? 'MedTrace General Hospital',
      role: json['role'] ?? 'Patient',
      createdAt: json['createdAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'hospitalName': hospitalName,
      'role': role,
      'createdAt': createdAt,
    };
  }
}


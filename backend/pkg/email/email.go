package email

import (
	"fmt"
	"net/smtp"
	"strings"
)

// EmailService handles sending emails
type EmailService interface {
	SendWelcomeEmail(studentEmail, mentorName, productName, loginURL string) error
}

type emailService struct {
	smtpHost string
	smtpPort string
	from     string
	password string
}

// NewEmailService creates a new email service
func NewEmailService(smtpHost, smtpPort, from, password string) EmailService {
	return &emailService{
		smtpHost: smtpHost,
		smtpPort: smtpPort,
		from:     from,
		password: password,
	}
}

// SendWelcomeEmail sends a welcome email to a student
func (s *emailService) SendWelcomeEmail(studentEmail, mentorName, productName, loginURL string) error {
	if s.smtpHost == "" || s.from == "" {
		// Email service not configured - silently skip
		return nil
	}

	subject := "Bem-vindo ao Aprova Cards!"

	htmlBody := s.buildWelcomeEmailHTML(studentEmail, mentorName, productName, loginURL)

	return s.sendEmail(studentEmail, subject, htmlBody)
}

func (s *emailService) buildWelcomeEmailHTML(studentEmail, mentorName, productName, loginURL string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
		.content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
		.welcome-title { font-size: 24px; font-weight: bold; margin: 20px 0; }
		.info-box { background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
		.info-label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
		.info-value { font-size: 16px; font-weight: 600; margin-top: 5px; }
		.btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
		.btn:hover { background: #764ba2; }
		.instructions { background: white; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
		.instructions h3 { margin: 15px 0 10px 0; font-size: 14px; }
		.instructions ol { margin: 10px 0; padding-left: 20px; }
		.instructions li { margin: 5px 0; }
		.footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Aprova Cards</h1>
			<p>Sua plataforma de estudo inteligente</p>
		</div>
		
		<div class="content">
			<div class="welcome-title">
				Bem-vindo ao Aprova Cards, %s! 🎓
			</div>
			
			<p>Parabéns! Sua compra foi confirmada com sucesso e você já está pronto para começar a estudar.</p>
			
			<div class="info-box">
				<div class="info-label">Seu Mentor</div>
				<div class="info-value">%s</div>
			</div>
			
			<div class="info-box">
				<div class="info-label">Curso Adquirido</div>
				<div class="info-value">%s</div>
			</div>
			
			<div class="info-box">
				<div class="info-label">Seu Email</div>
				<div class="info-value">%s</div>
			</div>
			
			<div style="text-align: center;">
				<a href="%s" class="btn">Acessar Aprova Cards</a>
			</div>
			
			<div class="instructions">
				<h3>Como Começar:</h3>
				<ol>
					<li>Clique no botão acima ou copie o link para seu navegador</li>
					<li>Faça login com seu email e senha</li>
					<li>Comece a estudar com os flashcards do seu mentor</li>
					<li>Acompanhe seu progresso em tempo real</li>
					<li>Maximize seu aprendizado com repetição espaçada</li>
				</ol>
			</div>
			
			<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
				<strong>Dica:</strong> Para melhor experiência, use a plataforma regularmente. A repetição espaçada é a chave para memorizar efetivamente!
			</div>
			
			<div class="footer">
				<p>Se tiver dúvidas ou problemas, entre em contato com %s ou com nosso suporte.</p>
				<p>&copy; 2026 Aprova Cards. Todos os direitos reservados.</p>
			</div>
		</div>
	</div>
</body>
</html>
	`,
		strings.Split(studentEmail, "@")[0],
		mentorName,
		productName,
		studentEmail,
		loginURL,
		mentorName,
	)
}

func (s *emailService) sendEmail(to, subject, htmlBody string) error {
	addr := fmt.Sprintf("%s:%s", s.smtpHost, s.smtpPort)

	message := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n%s",
		s.from,
		to,
		subject,
		htmlBody,
	)

	auth := smtp.PlainAuth("", s.from, s.password, s.smtpHost)
	err := smtp.SendMail(addr, auth, s.from, []string{to}, []byte(message))

	if err != nil {
		fmt.Printf("Warning: failed to send welcome email to %s: %v\n", to, err)
		return nil
	}

	return nil
}

// MockEmailService for testing
type MockEmailService struct{}

func (m *MockEmailService) SendWelcomeEmail(studentEmail, mentorName, productName, loginURL string) error {
	fmt.Printf("Mock: Would send welcome email to %s\n", studentEmail)
	return nil
}

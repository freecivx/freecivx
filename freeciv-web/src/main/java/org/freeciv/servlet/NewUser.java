/*******************************************************************************
 * FreecivX - the web version of Freeciv. http://www.FreecivWorld.net/
 * Copyright (C) 2009-2025 The Freeciv-web project
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
package org.freeciv.servlet;

import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.Properties;
import javax.mail.*;
import javax.mail.internet.*;
import javax.sql.*;
import org.apache.commons.codec.digest.DigestUtils;
import javax.naming.*;
import org.freeciv.services.Validation;
import org.freeciv.util.Constants;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Servlet to create a new FreecivX user account.
 */
@RestController
public class NewUser {

	@Autowired
	private Validation validation;

	@Value("${email.host:}")
	private String emailHost;

	@Value("${email.port:}")
	private String emailPort;

	@Value("${email.username:}")
	private String emailUsername;

	@Value("${email.password:}")
	private String emailPassword;

	@Value("${email.sender:}")
	private String emailSender;

	@PostMapping("/create_user")
	public ResponseEntity<String> createUser(
			@RequestParam("username") String username_param,
			@RequestParam("password") String password_param,
			@RequestParam("email") String email_param,
			jakarta.servlet.http.HttpServletRequest request) {

		String username = java.net.URLDecoder.decode(username_param, StandardCharsets.UTF_8);
		String password = java.net.URLDecoder.decode(password_param, StandardCharsets.UTF_8);
		String email = java.net.URLDecoder.decode(email_param.replace("+", "%2B"), StandardCharsets.UTF_8);

		// Validate inputs
		if (password == null || password.length() <= 2) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid password.");
		}
		if (!validation.isValidUsername(username)) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid username.");
		}
		if (email == null || email.length() <= 4) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid email address.");
		}

		String ipAddress = getClientIp(request);

		try (Connection conn = getConnection()) {
			if (isIPLimitExceeded(conn, ipAddress)) {
				return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("IP address limit exceeded.");
			}

			String randomNumber = "1" + RandomStringUtils.randomNumeric(20);
			createUserInDB(conn, username, email, password, ipAddress, randomNumber);
			sendEmailVerify(email, randomNumber);
			return ResponseEntity.ok("OK");
		} catch (Exception e) {
			e.printStackTrace();
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error creating user.");
		}
	}

	@GetMapping("/create_user")
	public ResponseEntity<String> getNotAllowed() {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body("POST method only.");
	}

	private String getClientIp(jakarta.servlet.http.HttpServletRequest request) {
		String ipAddress = request.getHeader("X-Real-IP");
		return (ipAddress != null) ? ipAddress : request.getRemoteAddr();
	}

	private Connection getConnection() throws NamingException, SQLException {
		Context env = (Context) new InitialContext().lookup(Constants.JNDI_CONNECTION);
		DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
		return ds.getConnection();
	}

	private boolean isIPLimitExceeded(Connection conn, String ipAddress) throws SQLException {
		String query = "SELECT COUNT(*) FROM auth WHERE ip = ?";
		try (PreparedStatement ps = conn.prepareStatement(query)) {
			ps.setString(1, ipAddress);
			try (ResultSet rs = ps.executeQuery()) {
				if (rs.next() && rs.getInt(1) > 20) {
					return true;
				}
			}
		}
		return false;
	}

	private void createUserInDB(Connection conn, String username, String email, String password, String ip, String verifyKey)
			throws SQLException {
		String insertQuery = "INSERT INTO auth (username, email, secure_hashed_password, ip, verifykey, elo_rating, last_login, verified) "
				+ "VALUES (?, ?, ?, ?, ?, 1000, NOW(), 0)";

		try (PreparedStatement ps = conn.prepareStatement(insertQuery)) {
			ps.setString(1, username.toLowerCase());
			ps.setString(2, email);
			ps.setString(3, DigestUtils.sha256Hex(password));
			ps.setString(4, ip);
			ps.setString(5, verifyKey);
			ps.executeUpdate();
		}
	}

	public void sendEmailVerify(String to, String randomNumber) throws MessagingException {
		String verificationLink = "https://www.FreecivWorld.net/verify?id=" + randomNumber;
		String emailBody = "Welcome to FreecivWorld,\n\nPlease verify your FreecivWorld.net account: \n"
				+ verificationLink + "\n\nThank you for joining!";
		sendEmail(to, "Welcome to FreecivWorld.net", emailBody);
	}

	public void sendEmail(String to, String subject, String body) throws MessagingException {
		Properties props = new Properties();
		props.put("mail.smtp.auth", "true");
		props.put("mail.smtp.starttls.enable", "true");
		props.put("mail.smtp.host", emailHost);
		props.put("mail.smtp.port", emailPort);

		Session session = Session.getInstance(props, new Authenticator() {
			protected PasswordAuthentication getPasswordAuthentication() {
				return new PasswordAuthentication(emailUsername, emailPassword);
			}
		});

		Message message = new MimeMessage(session);
		message.setFrom(new InternetAddress(emailSender));
		message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
		message.setSubject(subject);
		message.setText(body);

		Transport.send(message);
	}
}

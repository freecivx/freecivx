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
import java.io.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.WebServlet;
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

/**
 * Servlet to create a new FreecivX user account.
 */
@WebServlet("/create_user")
public class NewUser extends HttpServlet {

	private static final long serialVersionUID = 1L;
	private final Validation validation = new Validation();

	@Override
	public void doPost(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {

		String username = java.net.URLDecoder.decode(request.getParameter("username"), StandardCharsets.UTF_8);
		String password = java.net.URLDecoder.decode(request.getParameter("password"), StandardCharsets.UTF_8);
		String email = java.net.URLDecoder.decode(request.getParameter("email").replace("+", "%2B"), StandardCharsets.UTF_8);

		// Validate inputs
		if (!isValidInput(username, password, email, response)) {
			return;
		}

		String ipAddress = getClientIp(request);

		try (Connection conn = getConnection()) {
			if (isIPLimitExceeded(conn, ipAddress)) {
				response.sendError(HttpServletResponse.SC_BAD_REQUEST, "IP address limit exceeded.");
				return;
			}

			String randomNumber = "1" + RandomStringUtils.randomNumeric(20);
			createUser(conn, username, email, password, ipAddress, randomNumber);
			sendEmailVerify(email, randomNumber);
			response.getWriter().print("OK");
		} catch (Exception e) {
			e.printStackTrace();
			response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error creating user.");
		}
	}

	@Override
	public void doGet(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {
		response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "POST method only.");
	}


	private boolean isValidInput(String username, String password, String email, HttpServletResponse response)
			throws IOException {
		if (password == null || password.length() <= 2) {
			response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid password.");
			return false;
		}
		if (!validation.isValidUsername(username)) {
			response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid username.");
			return false;
		}
		if (email == null || email.length() <= 4) {
			response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid email address.");
			return false;
		}
		return true;
	}

	private String getClientIp(HttpServletRequest request) {
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

	private void createUser(Connection conn, String username, String email, String password, String ip, String verifyKey)
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

	public void sendEmailVerify(String to, String randomNumber) throws MessagingException, IOException {
		String verificationLink = "https://www.FreecivWorld.net/verify?id=" + randomNumber;
		String emailBody = "Welcome to FreecivWorld,\n\nPlease verify your FreecivWorld.net account: \n"
				+ verificationLink + "\n\nThank you for joining!";
		sendEmail(to, "Welcome to FreecivWorld.net", emailBody);
	}

	public void sendEmail(String to, String subject, String body) throws MessagingException, IOException {
		Properties prop = new Properties();
		prop.load(getServletContext().getResourceAsStream("/WEB-INF/config.properties"));

		Properties props = new Properties();
		props.put("mail.smtp.auth", "true");
		props.put("mail.smtp.starttls.enable", "true");
		props.put("mail.smtp.host", prop.getProperty("email_host"));
		props.put("mail.smtp.port", prop.getProperty("email_port"));

		Session session = Session.getInstance(props, new Authenticator() {
			protected PasswordAuthentication getPasswordAuthentication() {
				return new PasswordAuthentication(prop.getProperty("email_username"), prop.getProperty("email_password"));
			}
		});

		Message message = new MimeMessage(session);
		message.setFrom(new InternetAddress(prop.getProperty("email_sender")));
		message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
		message.setSubject(subject);
		message.setText(body);

		Transport.send(message);
	}
}

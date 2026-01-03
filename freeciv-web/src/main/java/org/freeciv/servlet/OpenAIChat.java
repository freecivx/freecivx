package org.freeciv.servlet;

import com.theokanning.openai.completion.chat.*;
import com.theokanning.openai.service.OpenAiService;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Properties;
import java.util.stream.Collectors;


/**
 * OpenAI chat
 *
 * URL: /openai_chat
 */
@WebServlet("/openai_chat")
public class OpenAIChat  extends HttpServlet {

    private final String model = "gpt-4o";

    @Override
    public void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
        try {
            response.setContentType("text/html; charset=UTF-8");
            response.setCharacterEncoding("UTF-8");

            String message = request.getReader().lines().collect(Collectors.joining(System.lineSeparator()));

            message = new String(Base64.getDecoder().decode(message));

            System.out.println("OpenAI message: " + message);

            Properties prop = new Properties();
            prop.load(getServletContext().getResourceAsStream("/WEB-INF/config.properties"));
            String key = prop.getProperty("openai_key");
            if (key == null || key.equals("")) {
                System.out.println("OpenAI key missing.");
                return;
            }

            OpenAiService service = new OpenAiService(key, Duration.ofSeconds(60));

            List<ChatMessage> messages = new ArrayList<>();

            // Player and game information to enhance the LLM response
            String fcivInfo = """
            You are an assistant in the game FreecivWorld.net, a 3D browser-based fork of Freeciv. Answer questions concisely and provide helpful tips. Max 100 words. 
            New cities are built using the shortcut 'B' or by right-clicking on a Settler unit and selecting 'Build city.' Units move with the 'G' (Goto) command or arrow keys. 
            
            Common Keyboard Shortcuts:
              - a: Auto-settler (settler/worker units).
              - b: Build city (settler units).
              - f: Fortify unit (military units) / Build fortress (settler/worker units).
              - g: Go to tile (left-click to select target).
              - h: Set unit's home city (to current tile's city).
              - i: Build irrigation or convert terrain (settler/worker units).
              - m: Build mine or convert terrain (settler/worker units).
              - N: Explode nuclear weapon.
              - p: Clean pollution (settler/worker units).
              - P: Pillage terrain.
              - r: Build road/railroad (settler/worker units).
              - s: Sentry unit.
              - S: Unsentry all units on tile.
              - L: Airlift unit to a city.
              - u: Unload unit from transporter.
              - x: Auto-explore.
            
            Mouse Controls:
              - Middle-click: Get map tile information.
              - Left-click: Select units or cities.
              - Right-click: Move the map.
              - Left-click and drag: Change view angle.
        """;

            ChatMessage systemMessage = new SystemMessage(fcivInfo);

            messages.add(systemMessage);


            for (String submessage : message.split(";")) {
                UserMessage userchat = new UserMessage(submessage);
                messages.add(userchat);
            }

            ChatCompletionRequest completionRequest = ChatCompletionRequest.builder()
                    .messages(messages)
                    .maxTokens(16384)
                    .model(model)
                    .build();
            List<ChatCompletionChoice> choices = service.createChatCompletion(completionRequest).getChoices();
            for (ChatCompletionChoice choice : choices) {

                response.setContentType("application/json");
                response.getWriter().write(String.format("{\"message\": \"%s\"}", choice.getMessage().getContent()));
            }


        } catch (Exception erro) {
            erro.printStackTrace();
            System.out.println(erro.getMessage());
        }
    }

}

# DiscordAutoMSG

module DiscordAutoMSG
  class Info
    VERSION = '1.0.0'.freeze
    AUTHOR = '@recutdev'.freeze
    REPOSITORY = 'https://github.com/recutdev/DiscordAutoMSG'.freeze
    LICENSE = 'MIT'.freeze

    def self.display
      puts "=" * 50
      puts "DiscordAutoMSG v#{VERSION}"
      puts "Author: #{AUTHOR}"
      puts "Repository: #{REPOSITORY}"
      puts "License: #{LICENSE}"
      puts "=" * 50
    end
  end
end

module Ruby
  # null
end

if __FILE__ == $0
  DiscordAutoMSG::Info.display
end

return nil if __FILE__ == $0

__END__

# return
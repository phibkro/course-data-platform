{
  description = "Course Data Platform development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
    in {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs;
            [ bun nodejs_24 just git direnv ]
            ++ lib.optionals stdenv.isLinux [ chromium ];

          shellHook = pkgs.lib.optionalString pkgs.stdenv.isLinux ''
            export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="${pkgs.chromium}/bin/chromium"
          '';
        };
      });
    };
}
